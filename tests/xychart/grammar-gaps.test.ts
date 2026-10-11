import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { parseXYChart } from "../../src/diagrams/xychart/parser.js";
import { TWO_PANES } from "../support/drawn.js";
import { withConfig } from "../support/frontmatter.js";

const ORIENTATIONS = ["vertical", "horizontal"] as const;
const CASES = ORIENTATIONS.flatMap((orientation) => TWO_PANES.map((width) => [orientation, width] as const));

const header = (orientation: string): string => `xychart-beta ${orientation}`;
const configured = (orientation: string, config: string, body: string): string =>
  withConfig(`  xyChart:\n${config}`, `${header(orientation)}\n${body}`);
const rows = (source: string, width: number): string[] => render(source, { width }).split("\n").map((row) => row.trimEnd());
const bars = (source: string, width: number): number => rows(source, width).join("\n").split("█").length - 1;

// Measured on mermaid 12.0.0 headless, 2026-09-29.
describe("xychart statements mermaid 12's lexer reads", () => {
  it.each(ORIENTATIONS)("reads a statement on the header line (%s)", (orientation) => {
    const chart = parseXYChart(`${header(orientation)} title "T" bar [1, 2]\n`);
    expect([chart.title, chart.datasets.length, chart.horizontal]).toEqual(["T", 1, orientation === "horizontal"]);
  });

  it.each(ORIENTATIONS)("ends a statement at `;` (%s)", (orientation) => {
    const chart = parseXYChart(`${header(orientation)}\n  title "T"; bar [1, 2, 3]\n`);
    expect([chart.title, chart.datasets[0]?.values]).toEqual(["T", [1, 2, 3]]);
  });

  it.each(ORIENTATIONS)("reads two statements on one line with no separator (%s)", (orientation) => {
    const chart = parseXYChart(`${header(orientation)}\n  bar [1, 2] line [3, 4]\n`);
    expect(chart.datasets.map((ds) => [ds.chartType, ds.values])).toEqual([["bar", [1, 2]], ["line", [3, 4]]]);
  });

  it.each(ORIENTATIONS)("takes a keyword glued to its list, or a tab after it (%s)", (orientation) => {
    for (const blank of ["", "\t"]) {
      const chart = parseXYChart(`${header(orientation)}\n  x-axis${blank}[a, b]\n  bar${blank}[5, 6]\n`);
      expect([chart.xCategories, chart.datasets[0]?.values]).toEqual([["a", "b"], [5, 6]]);
    }
  });

  it.each(ORIENTATIONS)("glues an axis's several-word unquoted title and keeps its range (%s)", (orientation) => {
    const x = parseXYChart(`${header(orientation)}\n  x-axis Big Month 1 --> 5\n  bar [1, 2]\n`);
    expect([x.xLabel, x.xRange]).toEqual(["BigMonth", [1, 5]]);
    const y = parseXYChart(`${header(orientation)}\n  y-axis Rev enue 0 --> 10\n  bar [1, 2]\n`);
    expect([y.yLabel, y.yRange]).toEqual(["Revenue", [0, 10]]);
  });

  it.each(ORIENTATIONS)("reads a bound with a leading dot (%s)", (orientation) => {
    const chart = parseXYChart(`${header(orientation)}\n  y-axis .5 --> 1.5\n  bar [1, 1.2]\n`);
    expect([chart.yLabel, chart.yRange]).toEqual(["", [0.5, 1.5]]);
  });

  it.each(CASES)("%s, width %i: draws the header line's statements", (orientation, width) => {
    const out = rows(`${header(orientation)} title "T" bar [1, 2]\n`, width);
    expect(out.some((row) => row.trim() === "T")).toBe(true);
    expect(bars(`${header(orientation)} title "T" bar [1, 2]\n`, width)).toBeGreaterThan(0);
  });
});

describe("xychart tick labels", () => {
  // mermaid's scale runs from the smallest value to the largest and labels d3's round ticks inside it, `tick.toString()`.
  it.each(CASES)("%s, width %i: a large value's round tick labels stay clear of the axis and of their neighbours", (orientation, width) => {
    const out = rows(`${header(orientation)}\n  bar [123456789, 5]\n`, width);
    expect(out.some((row) => /\b100000000\b/u.test(row))).toBe(true);
    if (orientation === "vertical") {
      for (const row of out.filter((line) => /\d ?[┤└│]/u.test(line))) expect(row).toMatch(/\d [┤└│]/u);
    } else {
      const scale = (out[out.findIndex((row) => row.includes("└")) + 1] ?? "").trim().split(/\s+/u);
      expect(scale.length).toBeGreaterThanOrEqual(2);
      for (const label of scale) expect(Number(label) % 10000000).toBe(0);
    }
  });

  it.each(CASES)("%s, width %i: small values get d3's round ticks, written as mermaid writes them", (orientation, width) => {
    const out = rows(`${header(orientation)}\n  bar [0.001, 0.002]\n`, width).join("\n");
    const labels = new Set(out.match(/0\.\d+/gu) ?? []);
    expect(labels.size).toBeGreaterThanOrEqual(3);
    for (const label of labels) {
      expect(label.length).toBeLessThanOrEqual(6);
      // d3 steps these by 0.0001 or a round multiple of it.
      expect(Math.abs(Number(label) * 1e4 - Math.round(Number(label) * 1e4))).toBeLessThan(1e-9);
    }
  });
});

describe("xychart config keys that hide a part", () => {
  const BODY = '  title "Tt"\n  x-axis "Xname" [aa, bb]\n  y-axis "Yname" 0 --> 10\n  bar [3, 6]\n';

  it.each(CASES)("%s, width %i: showTitle false takes the body title and the frontmatter one off", (orientation, width) => {
    expect(rows(configured(orientation, "    showTitle: false\n", BODY), width).join("\n")).not.toContain("Tt");
    const titled = `---\ntitle: Front\nconfig:\n  xyChart:\n    showTitle: false\n---\n${header(orientation)}\n  bar [3, 6]\n`;
    expect(rows(titled, width).join("\n")).not.toContain("Front");
  });

  it.each(CASES)("%s, width %i: an axis's showLabel and showTitle false take its names off", (orientation, width) => {
    const x = rows(configured(orientation, "    xAxis:\n      showLabel: false\n      showTitle: false\n", BODY), width).join("\n");
    expect(x).not.toMatch(/aa|bb|Xname/u);
    expect(x).toContain("Yname");
    const y = rows(configured(orientation, "    yAxis:\n      showLabel: false\n      showTitle: false\n", BODY), width).join("\n");
    expect(y).not.toMatch(/Yname|10/u);
    expect(y).toMatch(/aa[\s\S]*Xname|Xname[\s\S]*aa/u);
  });

  it.each(CASES)("%s, width %i: showTick and showAxisLine false take the ticks and the line off", (orientation, width) => {
    const both = "      showTick: false\n      showAxisLine: false\n";
    const out = rows(configured(orientation, `    xAxis:\n${both}    yAxis:\n${both}`, BODY), width).join("\n");
    expect(out).not.toMatch(/[┤┬└├]/u);
    const lines = rows(configured(orientation, "    xAxis:\n      showTick: false\n    yAxis:\n      showTick: false\n", BODY), width).join("\n");
    expect(lines).not.toMatch(/[┤┬├]/u);
    expect(lines).toContain("└");
  });

  it.each(CASES)("%s, width %i: the same keys through an init directive", (orientation, width) => {
    const source = `%%{init: {"xyChart": {"showTitle": false, "xAxis": {"showLabel": false}}}}%%\n${header(orientation)}\n${BODY}`;
    expect(rows(source, width).join("\n")).not.toMatch(/Tt|aa|bb/u);
  });

  it.each(CASES)("%s, width %i: showDataLabelOutsideBar writes the value past the bar's end", (orientation, width) => {
    const config = "    showDataLabel: true\n    showDataLabelOutsideBar: true\n";
    const out = rows(configured(orientation, config, "  x-axis [a, b]\n  y-axis 0 --> 10\n  bar [3, 6]\n"), width);
    if (orientation === "vertical") {
      const at = out.findIndex((row) => /\b6\b/u.test(row) && !row.includes("┤"));
      expect(at).toBeGreaterThan(-1);
      expect(out[at + 1]).toMatch(/[█▄]/u);
      expect(out[at]).not.toMatch(/[█▄]6|6[█▄]/u);
    } else {
      expect(out.some((row) => /[█▏▎▍▌▋▊▉] 6$/u.test(row))).toBe(true);
    }
  });
});

describe("xychart title wider than the chart", () => {
  const TITLE = "Quarterly revenue of the northern and southern regional offices compared year over year";
  const SOURCE = (orientation: string): string => `${header(orientation)}\n  title "${TITLE}"\n  x-axis [q1, q2]\n  bar [3, 6]\n`;
  const width = (row: string): number => [...row].length;

  it.each(CASES)("%s, width %i: widens within the budget, then folds on words, every word whole", (orientation, budget) => {
    const out = rows(SOURCE(orientation), budget);
    const plot = out.findIndex((row) => /[│┤└]/u.test(row));
    const heading = out.slice(0, plot).filter((row) => row.trim() !== "");
    expect(heading.map((row) => row.trim()).join(" ")).toBe(TITLE);
    const body = Math.max(...out.slice(plot).map(width));
    for (const row of heading) expect(width(row)).toBeLessThanOrEqual(Math.max(budget, body));
    if (TITLE.length <= Math.max(budget, body)) expect(heading).toHaveLength(1);
  });

  it.each(CASES)("%s, width %i: the x axis's title too, under the plot", (orientation, budget) => {
    const out = rows(`${header(orientation)}\n  x-axis "${TITLE}" [q1, q2]\n  bar [3, 6]\n`, budget);
    const foot = out.findIndex((row) => row.includes("Quarterly"));
    const words = out.slice(foot).filter((row) => row.trim() !== "");
    expect(words.map((row) => row.trim()).join(" ")).toBe(TITLE);
    const body = Math.max(...out.slice(0, foot).map(width));
    for (const row of words) expect(width(row)).toBeLessThanOrEqual(Math.max(budget, body));
  });
});
