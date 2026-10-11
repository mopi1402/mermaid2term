import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { NEWLINE } from "../../src/text/chars.js";
import { withConfig } from "../support/frontmatter.js";

const ORIENTATIONS = ["vertical", "horizontal"];

const chart = (orientation: string, body: string): string =>
  withConfig({ xyChart: { chartOrientation: orientation } }, `xychart-beta\n${body}`);

const drawn = (orientation: string, body: string): string[] => render(chart(orientation, body), { width: 80 }).split(NEWLINE);

// The words of the rows under or beside the plot a scale or the categories are written on.
const words = (rows: readonly string[]): string[] => rows.join(" ").split(/[\s│┤└┬─]+/u).filter((word) => word !== "");

// Read in mermaid 12.0.0's xychart db and chart builder: `transformDataWithoutCategory`, `setYAxisRangeFromPlotData`,
// `LinearAxis.getTickValues` (d3's `scale.ticks()`, the domain never made nice) and `tick.toString()`.
describe("an xychart scale as mermaid's", () => {
  it.each(ORIENTATIONS)("labels a written value range with d3's round ticks (%s)", (orientation) => {
    const out = words(drawn(orientation, "    x-axis [a, b, c]\n    y-axis 0 --> 40\n    bar [18, 22, 25]\n"));
    for (const label of ["0", "10", "20", "30", "40"]) expect(out).toContain(label);
    expect(out).not.toContain("8");
  });

  it.each(ORIENTATIONS)("runs an unwritten value range from the smallest value to the largest (%s)", (orientation) => {
    const rows = drawn(orientation, "    x-axis [a, b, c]\n    bar [5, 6, 7]\n");
    expect(words(rows)).toContain("5");
    expect(words(rows)).not.toContain("0");
    const plot = rows.join(NEWLINE);
    expect(plot.split("█").length - 1).toBeGreaterThan(0);
  });

  it.each(ORIENTATIONS)("cuts a plot to the categories and keeps every category on the axis (%s)", (orientation) => {
    const more = words(drawn(orientation, "    x-axis [a, b]\n    bar [1, 2, 3, 4]\n"));
    expect(more).not.toContain("3");
    const fewer = words(drawn(orientation, "    x-axis [a, b, c, d]\n    y-axis 0 --> 5\n    bar [1, 2]\n"));
    for (const name of ["a", "b", "c", "d"]) expect(fewer).toContain(name);
  });

  it("labels a numeric x range with d3's round ticks spread from the first point to the last", () => {
    const rows = drawn("vertical", "    x-axis 10 --> 20\n    y-axis 0 --> 10\n    line [3, 8, 2, 9, 4]\n");
    const axis = rows.findIndex((row) => row.includes("└"));
    expect(words([rows[axis + 1]])).toEqual(["10", "12", "14", "16", "18", "20"]);
  });

  it.each(ORIENTATIONS)("numbers an unwritten x axis from 1 to the longest plot (%s)", (orientation) => {
    const out = words(drawn(orientation, "    y-axis 0 --> 10\n    line [3, 8, 2]\n"));
    for (const label of ["1", "2", "3"]) expect(out).toContain(label);
  });

  it.each(ORIENTATIONS)("keeps the last x axis written, a band over a range before it (%s)", (orientation) => {
    const out = words(drawn(orientation, "    x-axis 10 --> 20\n    x-axis [north, south]\n    y-axis 0 --> 10\n    bar [3, 8]\n"));
    expect(out).toContain("north");
    expect(out).not.toContain("20");
  });
});
