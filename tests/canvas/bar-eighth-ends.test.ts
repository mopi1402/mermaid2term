// A horizontal bar, an xychart's or a pie legend's, ends on the eighth of a cell its value reaches, as a vertical
// xychart bar ends on its fractional block, where it used to drop what did not fill a whole cell.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { NEWLINE } from "../../src/text/chars.js";
import { glyphsOf } from "../../src/text/width.js";
import { TWO_PANES } from "../support/drawn.js";

const FULL = "█";
const EIGHTHS = [..."▏▎▍▌▋▊▉"];
// A bar's drawn length in eighths: its whole cells, and the eighth it ends on.
const eighthsOf = (row: readonly string[]): number =>
  row.reduce((sum, ch) => sum + (ch === FULL ? 8 : EIGHTHS.indexOf(ch) + 1), 0);
// The drawing's cells round a length to the nearest eighth, at most seven of them past its whole cells.
const nearEighth = (drawn: number, exact: number): void => {
  expect(Math.abs(drawn - exact * 8)).toBeLessThanOrEqual(1);
};

describe.each(TWO_PANES)("a horizontal bar ends on its eighth, at width %i", (width) => {
  it("draws an xychart bar up to the eighth of its value", () => {
    const source = ["xychart horizontal", "  x-axis [alpha, beta, gamma]", "  y-axis 0 --> 60", "  bar [20, 37, 13]"].join(NEWLINE);
    const rows = render(source, { width }).split(NEWLINE).map(glyphsOf);
    const axis = rows.findIndex((row) => row.includes("└"));
    const zero = rows[axis].indexOf("└");
    // The tick of 60 stands on the scale's last cell, the plot padded half a cell before it.
    const scale = rows[axis].lastIndexOf("┬") - zero - 1;
    const bar = (row: number): string[] => rows[row].slice(zero + 1);
    // A value is read on the middle of its tick's cell, so it reaches half a cell past its share of the scale.
    [20, 37, 13].forEach((value, i) => nearEighth(eighthsOf(bar(i * 2)), (value / 60) * scale + 0.5));
    expect(bar(2).some((ch) => EIGHTHS.includes(ch))).toBe(true);
  });

  it("draws a pie legend's bar up to the eighth of its share", () => {
    const source = ['pie title Pets', '  "Dogs" : 1', '  "Cats" : 2', '  "Rats" : 6'].join(NEWLINE);
    const rows = render(source, { width }).split(NEWLINE).map(glyphsOf);
    const stacked = rows.find((row) => row.includes(FULL) && !row.includes("┃"));
    const barWidth = (stacked ?? []).filter((ch) => ch === FULL).length;
    const legend = (label: string): string[] => {
      const row = rows.find((line) => line.join("").startsWith(label)) ?? [];
      return row.slice(row.indexOf("┃") + 1);
    };
    [["Dogs", 1], ["Cats", 2], ["Rats", 6]].forEach(([label, value]) =>
      nearEighth(eighthsOf(legend(String(label))), (Number(value) / 9) * barWidth));
    expect(["Dogs", "Cats", "Rats"].some((label) => legend(label).some((ch) => EIGHTHS.includes(ch)))).toBe(true);
  });
});
