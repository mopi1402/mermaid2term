import { describe, it, expect } from "vitest";
import { ACROSS_RUNS, ACROSS_STROKES, BOX, DASHED_HORIZONTAL, DASHED_VERTICAL, DOWN_RUNS, DOWN_STROKES } from "../../src/canvas/alphabet.js";
import { HEADS } from "../../src/canvas/glyphs.js";
import { must } from "../../src/must.js";

const ORACLE = new Map([
  ["⏷", "│┃┆┊╎╽╭╮┏┓┼"],
  ["⏶", "│┃┆┊╎╿╰╯┗┛┼"],
  ["⏵", "─━┄┈╌═╰╭┗┏┼"],
  ["⏴", "─━┄┈╌═╯╮┛┓┼"],
]);
const TEST = new Map([
  ["⏷", "│╭╮┼"],
  ["⏶", "│╰╯┼"],
  ["⏵", "─╰╭┼"],
  ["⏴", "─╯╮┼"],
]);
// A tee or a box wall right behind a head leaves the arrow a single cell, never a shaft.
const SHAFTLESS = "┬┴├┤█";

describe("the strokes of a run are ONE set: what `canvas.ts`, the graph renderer, the sequence renderer and the head oracle each listed", () => {
  it("across and down hold the light, the heavy, the six dashed strokes and the two half strokes the coarsest dash lays", () => {
    expect(ACROSS_STROKES).toEqual(new Set(["─", "━", ...DASHED_HORIZONTAL, BOX.halfLeft, BOX.heavyHalfLeft]));
    expect(DOWN_STROKES).toEqual(new Set(["│", "┃", ...DASHED_VERTICAL, BOX.halfUp, BOX.heavyHalfUp]));
    expect(DASHED_HORIZONTAL).toHaveLength(6);
    expect(DASHED_VERTICAL).toHaveLength(6);
  });
  it("the runs add the double rule the head oracle knew and the compaction did not", () => {
    expect([...ACROSS_RUNS].filter((g) => !ACROSS_STROKES.has(g))).toEqual(["═"]);
    expect([...DOWN_RUNS].filter((g) => !DOWN_STROKES.has(g))).toEqual(["║"]);
    for (const g of ACROSS_RUNS) expect(DOWN_RUNS.has(g)).toBe(false);
  });
});

describe("a head is fed by ONE table: every glyph the oracle or the test accepted is accepted, and the heavy dashes are known at last", () => {
  for (const [head, glyphs] of ORACLE) {
    it(`${head}: accepts all the oracle did, all the test did, and every stroke of its own axis`, () => {
      const feed = HEADS.get(head);
      expect(feed).toBeDefined();
      for (const g of glyphs) expect(feed?.allowed.has(g), `oracle glyph ${g}`).toBe(true);
      for (const g of must(TEST.get(head))) expect(feed?.allowed.has(g), `test glyph ${g}`).toBe(true);
      const strokes = head === "⏷" || head === "⏶" ? DOWN_RUNS : ACROSS_RUNS;
      const others = head === "⏷" || head === "⏶" ? ACROSS_RUNS : DOWN_RUNS;
      for (const g of strokes) expect(feed?.allowed.has(g), `stroke ${g}`).toBe(true);
      for (const g of others) expect(feed?.allowed.has(g), `cross stroke ${g}`).toBe(false);
      for (const g of SHAFTLESS) expect(feed?.allowed.has(g), `shaftless ${g}`).toBe(false);
    });
  }
  it("the feeding cell is one step back the way the head points", () => {
    expect(HEADS.get("⏷")).toMatchObject({ dr: -1, dc: 0 });
    expect(HEADS.get("⏶")).toMatchObject({ dr: 1, dc: 0 });
    expect(HEADS.get("⏵")).toMatchObject({ dr: 0, dc: -1 });
    expect(HEADS.get("⏴")).toMatchObject({ dr: 0, dc: 1 });
  });
});
