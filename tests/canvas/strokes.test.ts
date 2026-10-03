import { describe, expect, it } from "vitest";
import { Canvas } from "../../src/canvas/canvas.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { HEAVY_FROM_WIDTH, NO_BORDER_WIDTH, dashGlyphs, dashLevelOf, restyleBox, strokeWidthOf } from "../../src/canvas/strokes.js";

const props = (entries: Record<string, string>): ReadonlyMap<string, string> => new Map(Object.entries(entries));

describe("a stroke width is read in px, or not at all", () => {
  it("reads the number and ignores the unit", () => {
    expect(strokeWidthOf(props({ "stroke-width": "4px" }))).toBe(4);
    expect(strokeWidthOf(props({ "stroke-width": "0" }))).toBe(NO_BORDER_WIDTH);
  });
  it("is undefined where nothing is written or the text is no number", () => {
    expect(strokeWidthOf(props({}))).toBeUndefined();
    expect(strokeWidthOf(props({ "stroke-width": "thick" }))).toBeUndefined();
  });
  it("draws heavy from two px", () => {
    expect(HEAVY_FROM_WIDTH).toBe(2);
  });
});

describe("a dasharray is a level, its first number rounded up", () => {
  it("reads 0 for none or nothing, and the ceiling of the first number otherwise", () => {
    expect(dashLevelOf(props({}))).toBe(0);
    expect(dashLevelOf(props({ "stroke-dasharray": "none" }))).toBe(0);
    expect(dashLevelOf(props({ "stroke-dasharray": "2.5 3" }))).toBe(3);
  });
  it("names no glyphs for a solid line and a denser vertical than horizontal otherwise", () => {
    expect(dashGlyphs(0, false)).toBeUndefined();
    const light = dashGlyphs(3, false);
    expect(light?.across(0)).toBe("╌");
    expect(light?.down(0)).toBe("┆");
  });
  it("draws a glyph every other cell from level five across, the coarsest glyph down", () => {
    const sparse = dashGlyphs(5, true);
    expect([sparse?.across(0), sparse?.across(1), sparse?.across(2)]).toEqual([" ", "━", " "]);
    expect(sparse?.down(0)).toBe("╹");
  });
});

describe("a box's ring is recast from its props", () => {
  const box = (): Canvas => {
    const canvas = new Canvas(5, 3);
    const ring = ["┌───┐", "│   │", "└───┘"];
    ring.forEach((line, r) => [...line].forEach((ch, c) => canvas.put(r, c, ch, false)));
    return canvas;
  };
  it("turns heavy for a stroke-width of two px", () => {
    const canvas = box();
    restyleBox(canvas, 0, 0, 3, 5, props({ "stroke-width": "2px" }), UNICODE);
    expect(canvas.get(0, 0)).toBe("┏");
    expect(canvas.get(0, 2)).toBe("━");
  });
  it("is blanked for a stroke-width of zero", () => {
    const canvas = box();
    restyleBox(canvas, 0, 0, 3, 5, props({ "stroke-width": "0" }), UNICODE);
    expect(canvas.get(0, 0)).toBe(" ");
    expect(canvas.get(1, 4)).toBe(" ");
  });
  it("keeps a plain box plain", () => {
    const canvas = box();
    const before = canvas.toString();
    restyleBox(canvas, 0, 0, 3, 5, props({ fill: "#fff" }), UNICODE);
    expect(canvas.toString()).toBe(before);
  });
});
