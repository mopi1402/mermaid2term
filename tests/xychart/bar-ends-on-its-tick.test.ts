import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { NEWLINE } from "../../src/text/chars.js";
import { glyphsOf } from "../../src/text/width.js";

const EIGHTHS = [..."▏▎▍▌▋▊▉█"];
// A vertical bar's cell by how many eighths of it are inked.
const UPWARD = [..." ▁▂▃▄▅▆▇█"];
// A bar's drawn length in cells, its whole ones and the eighth it ends on.
const lengthOf = (row: readonly string[], from: number): number => row.slice(from).reduce((sum, ch) => sum + (EIGHTHS.indexOf(ch) + 1) / 8, 0);

describe("a bar ends on the middle of its value's tick, where the tick is read", () => {
  it.each([
    ["horizontal", 80, 1 / 16],
    // A narrowed plot's ticks fall between cells: each stands on the nearest, half a cell off at most.
    ["horizontal", 44, 0.5],
    ["horizontal", 48, 0.5],
  ])("draws the bars of 20 and 40 up to their ticks (%s, width %i)", (_orientation, width, tolerance) => {
    const source = ["xychart horizontal", "  x-axis [alpha, beta]", "  y-axis 0 --> 50", "  bar [20, 40]"].join(NEWLINE);
    const rows = render(source, { width }).split(NEWLINE).map(glyphsOf);
    const axis = rows.findIndex((row) => row.includes("└"));
    const zero = rows[axis].indexOf("└");
    const labels = rows[axis + 1].join("");
    const tickUnder = (value: string): number => labels.indexOf(value) + Math.floor(value.length / 2);
    for (const { row, value } of [{ row: 0, value: "20" }, { row: 2, value: "40" }]) {
      const tick = tickUnder(value);
      expect(rows[axis][tick]).toBe("┬");
      const end = zero + 1 + lengthOf(rows[row], zero + 1);
      expect(Math.abs(end - (tick + 0.5))).toBeLessThanOrEqual(tolerance);
    }
  });

  it("draws a vertical bar of 30 half way between the ticks of 20 and 40", () => {
    const source = ["xychart-beta", "  x-axis [a, b]", "  y-axis 0 --> 100", "  bar [30, 40]"].join(NEWLINE);
    const rows = render(source, { width: 80 }).split(NEWLINE).map(glyphsOf);
    const axis = rows.findIndex((row) => row.includes("└"));
    const rowOf = (label: string): number => rows.findIndex((row) => row.join("").trimStart().startsWith(`${label} ┤`));
    const col = rows[axis].indexOf("┬");
    const height = rows.slice(0, axis).reduce((sum, row) => sum + Math.max(0, UPWARD.indexOf(row[col] ?? " ")) / 8, 0);
    const middleOf = (label: string): number => axis - rowOf(label) - 0.5;
    expect(height).toBeCloseTo((middleOf("20") + middleOf("40")) / 2, 5);
  });
});
