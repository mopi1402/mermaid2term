import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { parseTimeline } from "../../src/diagrams/timeline/parser.js";
import { renderTimelineHorizontal, renderTimelineVertical } from "../../src/diagrams/timeline/render.js";

describe("a timeline drawn ACROSS when its header says so", () => {
  const body =
    "    title Release plan\n    section Design\n        Wireframes : Sketches : Reviews\n        Mockups : Figma\n" +
    "    section Build\n        Frontend : React\n        Backend : API : Database\n    section Ship\n        Launch\n";
  const foldable =
    "    2022 : Consolidated alerting layers\n    2023 : Introduced runbook automation\n    2024 : Added deterministic deployment gates\n";
  const ACROSS = "⏵";
  const DOWN = "●──";
  const ROOM = 80;
  const TIGHT = 40;

  it("reads the direction off the header, and only where the header says one", () => {
    expect(parseTimeline(`timeline LR\n${body}`).direction).toBe("LR");
    expect(parseTimeline(`timeline TD\n${body}`).direction).toBe("TD");
    expect(parseTimeline(`timeline td\n${body}`).direction).toBe("TD");
    expect(parseTimeline(`timeline\n${body}`).direction).toBeUndefined();
    expect(parseTimeline(`timeline XX\n${body}`).direction).toBeUndefined();
  });

  it("draws a WRITTEN direction as asked, whatever it costs in columns", () => {
    expect(render(`timeline LR\n${body}`, { width: TIGHT })).toContain(ACROSS);
    expect(render(`timeline TD\n${body}`, { width: 200 })).toContain(DOWN);
  });

  it("takes mermaid's default where the header names none, which is ACROSS", () => {
    expect(render(`timeline\n${body}`, { width: ROOM })).toContain(ACROSS);
    expect(render(`timeline\n${body}`)).toContain(ACROSS);
  });

  it("turns the default onto the free axis only when even its tightest fold cannot hold the budget", () => {
    expect(render(`timeline\n${body}`, { width: TIGHT })).toContain(DOWN);
    expect(render(`timeline\n${body}`, { width: TIGHT })).not.toContain(ACROSS);
    expect(render(`timeline\n${body}`, { width: TIGHT, autoRotate: false })).toContain(ACROSS);

    const folding = parseTimeline(`timeline\n${foldable}`);
    const natural = renderTimelineHorizontal(folding).width;
    const tightest = renderTimelineHorizontal(folding, UNICODE, undefined, 1).width;
    expect(tightest).toBeLessThan(natural);
    for (const width of [tightest, natural - 1]) {
      const drawn = render(`timeline\n${foldable}`, { width });
      expect(drawn, `width ${width}`).toContain(ACROSS);
      expect(drawn).toBe(render(`timeline LR\n${foldable}`, { width }));
    }
    expect(render(`timeline\n${foldable}`, { width: tightest - 1 })).toContain(DOWN);
  });

  it("never turns a direction that WAS written, which is what tells the two rules apart", () => {
    const asked = render(`timeline LR\n${body}`, { width: TIGHT });
    expect(asked).toBe(render(`timeline LR\n${body}`, { width: TIGHT, autoRotate: false }));
  });

  it("gives every event its own cell under the band of its section, the detail inside it", () => {
    const rows = renderTimelineHorizontal(parseTimeline(`timeline LR\n${body}`)).toString().split("\n");
    const band = rows.findIndex((row) => row.includes("Design"));
    expect(band).toBeGreaterThan(0);
    expect(rows[band].split("│").filter((cell) => cell.trim() !== "")).toHaveLength(3);
    const titles = rows[band + 2];
    expect(titles.split("│").filter((cell) => cell.trim() !== "")).toHaveLength(5);
    expect(rows[band + 3]).toMatch(/│\s*Sketches\s*│\s*Figma\s*│/u);
    expect(rows[rows.length - 1].endsWith(ACROSS)).toBe(true);
  });

  it("paints the band of a section as a FILL, blanks included, and never past its own boundary", () => {
    const canvas = renderTimelineHorizontal(parseTimeline(`timeline LR\n${body}`));
    const rows = canvas.toString().split("\n");
    const band = rows.findIndex((row) => row.includes("Design"));
    const line = rows[band];
    const styleOf = (label: string): string => canvas.getStyle(band, line.indexOf(label));
    expect(styleOf("Design")).toBe("section:0");
    expect(styleOf("Build")).toBe("section:1");
    expect(styleOf("Ship")).toBe("section:2");

    const walls = [...line].flatMap((ch, at) => (ch === "│" ? [at] : []));
    expect(walls.length).toBeGreaterThan(2);
    for (const at of walls) expect(canvas.getStyle(band, at)).toBe("default");
    expect(canvas.getStyle(band, (walls[0]) + 1)).toBe("section:0");
  });

  it("leaves every border bare, colour saying which section a cell is in and nothing else", () => {
    const canvas = renderTimelineHorizontal(parseTimeline(`timeline LR\n${body}`));
    const rows = canvas.toString().split("\n");
    rows.slice(0, rows.findIndex((row) => row.includes("└"))).forEach((row, at) => {
      [...row].forEach((ch, col) => {
        if (!"┌┐└┘├┤┬┴┼─".includes(ch)) return;
        expect(canvas.getStyle(at, col), `${ch} at ${at}:${col}`).toBe("default");
      });
    });
    const axis = rows.length - 1;
    expect(canvas.getStyle(axis, 0)).toBe("edge");
    expect(canvas.getStyle(axis, rows[axis].length - 1)).toBe("arrow");

    const dropper = rows[axis - 1];
    expect(dropper.trim()).toMatch(/^│(\s+│)+$/u);
    expect([...dropper].filter((ch) => ch === "│")).toHaveLength(5);
    expect(canvas.getStyle(axis - 1, dropper.indexOf("│"))).toBe("edge");
    const titles = rows.findIndex((row) => row.includes("Wireframes"));
    expect(canvas.getStyle(titles, rows[titles].indexOf("Wireframes"))).toBe("sectionfg:0");
    expect(canvas.getStyle(titles, rows[titles].indexOf("Launch"))).toBe("sectionfg:2");
  });

  it("never spends a budget it was NOT given, at any width", () => {
    const tl = parseTimeline(`timeline LR\n${body}`);
    const natural = renderTimelineHorizontal(tl).width;
    for (let budget = natural; budget <= natural + 80; budget++) {
      expect(renderTimelineHorizontal(tl, UNICODE, budget).width, `budget ${budget}`).toBeLessThanOrEqual(budget);
    }
  });

  it("turns ONCE as the budget grows, and never back, the fold holding it across below its natural width", () => {
    for (const source of [body, foldable]) {
      const tightest = renderTimelineHorizontal(parseTimeline(`timeline\n${source}`), UNICODE, undefined, 1).width;
      const turned: boolean[] = [];
      for (let width = 30; width <= 140; width += 1) turned.push(render(`timeline\n${source}`, { width }).includes(DOWN));
      expect(turned[0]).toBe(true);
      expect(turned[turned.length - 1]).toBe(false);
      expect(turned.slice(1).filter((down, at) => down !== turned[at]).length).toBe(1);
      expect(turned.indexOf(false) + 30).toBe(tightest);
    }
  });

  it("SPENDS an announced budget, every column taking the same width", () => {
    const tight = renderTimelineHorizontal(parseTimeline(`timeline LR\n${body}`));
    const spread = renderTimelineHorizontal(parseTimeline(`timeline LR\n${body}`), UNICODE, 100);
    expect(tight.width).toBe(56);
    expect(spread.width).toBeGreaterThan(90);
    expect(spread.width).toBeLessThanOrEqual(100);

    const rows = spread.toString().split("\n");
    const line = rows[rows.findIndex((row) => row.includes("Wireframes"))];
    const walls = [...line].flatMap((ch, at) => (ch === "│" ? [at] : []));
    const steps = new Set(walls.slice(1).map((at, i) => at - (walls[i])));
    expect(steps.size).toBe(1);
  });
});

describe("a timeline trunk painted in its SECTION's colour and not the detail's", () => {
  const source =
    "timeline\n    section Design\n        Wireframes : Sketches : Reviews\n        Mockups : Figma\n" +
    "    section Build\n        Frontend : React\n    section Ship\n        Launch\n";
  const TRUNK = 1;
  const DETAIL = 5;

  it("paints every cell of the trunk from its own section, detail rows included", () => {
    const canvas = renderTimelineVertical(parseTimeline(source));
    const rows = canvas.toString().split("\n");
    const trunks = rows.filter((row) => row.charAt(TRUNK) === "│");
    expect(trunks.length).toBeGreaterThan(4);
    rows.forEach((row, at) => {
      if (row.charAt(TRUNK) !== "│") return;
      expect(canvas.getStyle(at, TRUNK), row).toMatch(/^sectionfg:/u);
    });
  });

  it("writes the detail itself in its section's event ink, as mermaid draws an event as a box of its section", () => {
    const canvas = renderTimelineVertical(parseTimeline(source));
    const rows = canvas.toString().split("\n");
    const written = (row: string): boolean => row.charAt(TRUNK) === "│" && row.length > DETAIL;
    expect(rows.filter(written).length).toBeGreaterThan(2);
    rows.forEach((row, at) => {
      if (!written(row)) return;
      expect(canvas.getStyle(at, DETAIL), row).toMatch(/^timeline_event:/u);
    });
  });

  it("tells two sections apart, the trunk of the second not being painted like the first", () => {
    const canvas = renderTimelineVertical(parseTimeline(source));
    const rows = canvas.toString().split("\n");
    const seen = new Set(
      rows.flatMap((row, at) => (row.charAt(TRUNK) === "│" ? [canvas.getStyle(at, TRUNK)] : []))
    );
    expect(seen.size).toBe(3);
  });
});
