import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

// A `themeVariables` colour is read one way by every kind: a terminal colour name as that colour, any other CSS
// colour as its hex, never the grey a kind falls back on when it reads no colour at all.
const gantt = (variable: string): string =>
  withConfig({ themeVariables: { taskBkgColor: `"${variable}"` } }, "gantt\n  dateFormat YYYY-MM-DD\n  section S\n  Task one :a1, 2024-01-01, 10d");
const xychart = (palette: string): string =>
  withConfig({ themeVariables: { xyChart: { plotColorPalette: `"${palette}"` } } }, "xychart-beta\n  x-axis [a, b, c]\n  bar [1, 2, 3]\n  line [3, 2, 1]");

describe.each(["dark", "light"] as const)("a theme colour written by name (%s page)", (background) => {
  const drawn = (source: string): string => renderThemed(source, { width: 60, background }, "default");

  it("fills a gantt task `taskBkgColor: red` as the terminal's red, never the fallback grey", () => {
    expect(drawn(gantt("red"))).toBe(drawn(gantt("#bb0000")));
    expect(drawn(gantt("red"))).not.toBe(drawn(gantt("#123456")));
  });

  it("reads each `plotColorPalette` entry of an xychart on its own, a CSS name as its hex", () => {
    expect(drawn(xychart("tomato, #00ff00"))).toBe(drawn(xychart("#ff6347, #00ff00")));
    expect(drawn(xychart("red, #00ff00"))).toBe(drawn(xychart("#bb0000, #00ff00")));
  });
});
