import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { parseQuadrant } from "../../src/diagrams/quadrant/parser.js";
import { TWO_PANES } from "../support/drawn.js";
import { withConfig } from "../support/frontmatter.js";

const rows = (source: string, width: number): string[] => render(source, { width }).split("\n");
const rowOf = (drawing: readonly string[], word: string): number => drawing.findIndex((row) => row.includes(word));
const frameTop = (drawing: readonly string[]): number => drawing.findIndex((row) => row.includes("┌"));
const frameFoot = (drawing: readonly string[]): number => drawing.findIndex((row) => row.includes("└"));
const configured = (config: string, body: string): string => withConfig(`  quadrantChart:\n${config}`, `quadrantChart\n${body}`);
const AXES = "  x-axis Lx --> Rx\n  y-axis Dy --> Uy\n";

// Measured on mermaid 12.0.0 headless, 2026-09-29.
describe("quadrant statements mermaid 12's lexer reads", () => {
  it("reads a statement on the header line", () => {
    expect(parseQuadrant("quadrantChart title Hello there\n  A: [0.3, 0.6]\n").title).toBe("Hello there");
    expect(parseQuadrant("quadrantChart x-axis L --> R\n").xLabel).toBe("L -> R");
  });

  it("ends a statement at `;`, a title running to its line's end", () => {
    const chart = parseQuadrant("quadrantChart\n  x-axis L --> R; y-axis D --> U; quadrant-1 Q1x\n  A: [0.2, 0.7]; B: [0.5, 0.5]\n  title T; C: [0.1, 0.1]\n");
    expect([chart.xLabel, chart.yLabel, chart.quadrant1, chart.title]).toEqual(["L -> R", "D -> U", "Q1x", "T; C: [0.1, 0.1]"]);
    expect(chart.points.map((point) => point.label)).toEqual(["A", "B"]);
  });

  it.each(TWO_PANES)("width %i: draws the header line's title", (width) => {
    expect(rows("quadrantChart title Hello there\n  A: [0.3, 0.6]\n", width).some((row) => row.trim() === "Hello there")).toBe(true);
  });
});

describe("quadrant axis positions", () => {
  it.each(TWO_PANES)("width %i: with no point the x axis sits on top unless xAxisPosition says bottom", (width) => {
    const top = rows(`quadrantChart\n${AXES}`, width);
    expect(rowOf(top, "Lx")).toBeLessThan(frameTop(top));
    const bottom = rows(configured("    xAxisPosition: bottom\n", AXES), width);
    expect(rowOf(bottom, "Lx")).toBeGreaterThan(frameFoot(bottom));
  });

  it.each(TWO_PANES)("width %i: a plotted point takes the x axis to the bottom whatever xAxisPosition says", (width) => {
    const drawing = rows(configured("    xAxisPosition: top\n", `${AXES}  A: [0.3, 0.6]\n`), width);
    expect(rowOf(drawing, "Lx")).toBeGreaterThan(frameFoot(drawing));
  });

  it.each(TWO_PANES)("width %i: yAxisPosition right ends the y axis's line on the frame's right edge", (width) => {
    const drawing = rows(configured("    yAxisPosition: right\n", `${AXES}  A: [0.3, 0.6]\n`), width);
    const edge = drawing[frameTop(drawing)].trimEnd().length;
    expect(drawing[rowOf(drawing, "Uy")].trimEnd().length).toBe(edge);
    expect(drawing[rowOf(drawing, "Uy")].startsWith(" ")).toBe(true);
  });

  it.each(TWO_PANES)("width %i: the same keys through an init directive", (width) => {
    const source = `%%{init: {"quadrantChart": {"xAxisPosition": "bottom", "yAxisPosition": "right"}}}%%\nquadrantChart\n${AXES}`;
    const drawing = rows(source, width);
    expect(rowOf(drawing, "Lx")).toBeGreaterThan(frameFoot(drawing));
    expect(drawing[rowOf(drawing, "Uy")].startsWith(" ")).toBe(true);
  });
});

describe("quadrant texts that meet", () => {
  it.each(TWO_PANES)("width %i: two points on one cell keep both labels", (width) => {
    const drawing = rows("quadrantChart\n  Alpha: [0.5, 0.5]\n  Beta: [0.5, 0.5]\n", width).join("\n");
    expect(drawing).toContain("Alpha");
    expect(drawing).toContain("Beta");
  });

  it.each(TWO_PANES)("width %i: a label keeps clear of a quadrant's name and a point never covers one", (width) => {
    const source = "quadrantChart\n  quadrant-4 Delegate\n  quadrant-3 Drop\n  Legacy shim: [0.7, 0.2]\n  Log cleanup: [0.2, 0.2]\n";
    const drawing = rows(source, width).join("\n");
    for (const word of ["Delegate", "Drop", "Legacy shim", "Log cleanup"]) expect(drawing).toContain(word);
  });

  it.each(TWO_PANES)("width %i: a label wider than the plot is cut to its room, never dropped", (width) => {
    const label = "L".repeat(70);
    const drawing = rows(`quadrantChart\n  ${label}: [0.02, 0.1]\n`, width).join("\n");
    expect(drawing).toMatch(/L{20,}[….]│/u);
  });
});

describe("quadrant plot within the width budget", () => {
  const CAMPAIGNS = [
    "quadrantChart",
    "  title Reach and engagement of the spring campaigns",
    "  x-axis Low Reach --> High Reach",
    "  y-axis Low Engagement --> High Engagement",
    "  quadrant-1 We should expand",
    "  quadrant-2 Need to promote",
    "  quadrant-3 Re-evaluate",
    "  quadrant-4 May be improved",
    "  Campaign A: [0.3, 0.6]",
    "  Campaign B: [0.45, 0.23]",
    "  Campaign D: [0.78, 0.34]",
    "",
  ].join("\n");
  const widest = (drawing: readonly string[]): number => Math.max(...drawing.map((row) => [...row].length));
  const words = (drawing: readonly string[]): string => drawing.join(" ").replace(/[│┌┐└┘├┤┬┴┼─↑●]/gu, " ").replace(/\s+/gu, " ");

  it.each([30, 40] as const)("width %i: the plot shrinks to the budget, every text still read whole", (width) => {
    const drawing = rows(CAMPAIGNS, width);
    expect(widest(drawing)).toBeLessThanOrEqual(width);
    for (const text of ["Campaign A", "Campaign B", "Campaign D"]) expect(words(drawing)).toContain(text);
    // A quadrant's name may fold on words within its quadrant, never cut.
    const cells = words(drawing).split(" ");
    for (const word of "We should expand Need to promote Re-evaluate May be improved".split(" ")) expect(cells).toContain(word);
    expect(drawing.join("\n")).not.toContain("…");
    expect(words(drawing)).toContain("Low Reach -> High Reach");
    expect(words(drawing)).toContain("spring campaigns");
  });

  it.each([80, 120] as const)("width %i: the plot keeps its full 60 cells", (width) => {
    const drawing = rows(CAMPAIGNS, width);
    expect(drawing[frameTop(drawing)].trimEnd().length).toBe(63);
  });
});
