import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { displayWidth, glyphsOf } from "../../src/text/width.js";

const WIDTHS = [60, 80] as const;
const AXES = "  x-axis L --> H\n  y-axis L --> H\n";
const SOURCES = [
  `quadrantChart\n  title T\n${AXES}  漢字漢字 🎉: [0.3, 0.6]\n`,
  `quadrantChart\n${AXES}  quadrant-1 漢字の象限\n  quadrant-2 🎉🎉 party\n  右端の点: [0.97, 0.2]\n  左 ✅: [0.02, 0.8]\n`,
] as const;
const CASES = WIDTHS.flatMap((width) => SOURCES.map((source) => [width, source] as const));
const WALLS = new Set(["│", "├", "┤", "┼", "┬", "┴", "┌", "┐", "└", "┘"]);

// The display column of every frame or axis glyph on a row.
const wallsOf = (row: string): number[] => {
  const cols: number[] = [];
  let col = 0;
  for (const glyph of glyphsOf(row)) {
    if (WALLS.has(glyph)) cols.push(col);
    col += displayWidth(glyph);
  }
  return cols;
};

describe("quadrant labels holding wide glyphs", () => {
  it.each(CASES)("width %i: every chart row as wide as the frame, its side walls in the frame's columns", (width, source) => {
    const drawing = render(source, { width }).split("\n");
    const chart = drawing.slice(drawing.findIndex((row) => row.includes("┌")), drawing.findIndex((row) => row.includes("└")) + 1);
    expect(new Set(chart.map((row) => displayWidth(row.trimEnd())))).toEqual(new Set([displayWidth(chart[0].trimEnd())]));
    const [left, right] = [wallsOf(chart[0])[0], wallsOf(chart[0]).at(-1)];
    for (const row of chart) expect([wallsOf(row)[0], wallsOf(row).at(-1)]).toEqual([left, right]);
  });

  it.each(WIDTHS)("width %i: draws the whole label", (width) => {
    expect(render(SOURCES[0], { width })).toContain("漢字漢字 🎉");
  });
});
