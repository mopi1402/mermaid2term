import { describe, expect, it } from "vitest";

import { renderThemed } from "../../src/index.js";

// Dark enough to read on a white page as written, so no weighing moves them.
const INKS = {
  titleColor: ["#7a0000", "122;0;0"],
  xAxisTitleColor: ["#004d00", "0;77;0"],
  xAxisLabelColor: ["#00007a", "0;0;122"],
  yAxisTitleColor: ["#5c005c", "92;0;92"],
  yAxisLabelColor: ["#004d4d", "0;77;77"],
  legendTextColor: ["#4d3300", "77;51;0"],
  dataLabelColor: ["#330066", "51;0;102"],
  xAxisLineColor: ["#663300", "102;51;0"],
  yAxisLineColor: ["#003366", "0;51;102"],
  yAxisTickColor: ["#660033", "102;0;51"],
} satisfies Record<string, readonly [string, string]>;

const source = (orientation: string): string =>
  [
    "---",
    "config:",
    "  theme: base",
    "  themeVariables:",
    "    xyChart:",
    ...Object.entries(INKS).map(([name, [hex]]) => `      ${name}: "${hex}"`),
    "  xyChart:",
    `    chartOrientation: ${orientation}`,
    "    showDataLabel: true",
    "---",
    "xychart-beta",
    '    title "Sales"',
    '    x-axis "Month" [jan, feb]',
    '    y-axis "Units" 0 --> 50',
    '    bar "Shop" [40, 30]',
  ].join("\n");

const inkBefore = (out: string, rgb: string, text: string): boolean => new RegExp(`38;2;${rgb}m[^\\u001b]*${text}`, "u").test(out);

// mermaid 12's `theme-base.js` reads each of them from `themeVariables.xyChart`, `primaryTextColor` where unwritten.
describe("an xychart's texts and axes in their own xyChart inks", () => {
  it.each(["vertical", "horizontal"])("inks each text with its own variable (%s)", (orientation) => {
    const out = renderThemed(source(orientation), { width: 80, background: "light" }, "base");
    expect(inkBefore(out, INKS.titleColor[1], "Sales")).toBe(true);
    expect(inkBefore(out, INKS.xAxisTitleColor[1], "Month")).toBe(true);
    expect(inkBefore(out, INKS.xAxisLabelColor[1], "jan")).toBe(true);
    expect(inkBefore(out, INKS.yAxisTitleColor[1], "Units")).toBe(true);
    expect(inkBefore(out, INKS.yAxisLabelColor[1], "50")).toBe(true);
    expect(inkBefore(out, INKS.legendTextColor[1], "Shop")).toBe(true);
    expect(inkBefore(out, INKS.dataLabelColor[1], "40")).toBe(true);
  });

  it.each(["vertical", "horizontal"])("strokes each axis line and tick with its own variable (%s)", (orientation) => {
    const out = renderThemed(source(orientation), { width: 80, background: "light" }, "base");
    const across = orientation === "vertical" ? INKS.xAxisLineColor : INKS.yAxisLineColor;
    const down = orientation === "vertical" ? INKS.yAxisLineColor : INKS.xAxisLineColor;
    expect(out).toMatch(new RegExp(`38;2;${across[1]}m─`, "u"));
    expect(out).toMatch(new RegExp(`38;2;${down[1]}m│`, "u"));
    expect(out).toMatch(new RegExp(`38;2;${INKS.yAxisTickColor[1]}m[┤┬]`, "u"));
  });
});
