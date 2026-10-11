import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const BAR_RE = /\[([0-9;]*)m[█▄]+/gu;
const WORD_RE = /\[([0-9;]*)m(?:Sales|jan|Month)/gu;

const chart = (orientation: string, head = ""): string =>
  withConfig(`  xyChart:\n    chartOrientation: ${orientation}\n${head}`, "") +
  'xychart-beta\n    title "Sales"\n    x-axis "Month" [jan, feb, mar]\n    y-axis 0 --> 10\n    bar [3, 5, 7]\n    bar [2, 4, 6]\n';

// Whether an SGR code sets a ground, its parameters read in turn, a colour's own three skipped.
const grounded = (code: string): boolean => {
  const params = code.split(";").map(Number);
  for (let i = 0; i < params.length; i++) {
    if (params[i] === 48) return true;
    if (params[i] === 38 && params[i + 1] === 2) i += 4;
  }
  return false;
};
// The codes cells are painted in; a bar's top laid on an earlier bar, its colour kept as the ground, is its own test's.
const codes = (text: string, re: RegExp): Set<string> => new Set([...text.matchAll(re)].map((m) => m[1]).filter((code) => !grounded(code)));

// Measured on mermaid 12.0.0 headless: each plot takes its seat of `plotColorPalette`, the same for all its bars, and
// the title, the axis texts and the axes take `primaryTextColor`.
describe("xychart plots in their plotColorPalette seat", () => {
  it.each(["vertical", "horizontal"])("paints redux-dark's two bars in #FFF4DD and #FFD8B1, its texts in #E0DFDF (%s)", (orientation) => {
    const out = renderThemed(chart(orientation), { width: 80, background: "dark" }, "redux-dark");
    expect(codes(out, BAR_RE)).toEqual(new Set(["38;2;255;244;221", "38;2;255;216;177"]));
    for (const code of codes(out, WORD_RE)) expect(code).toMatch(/38;2;224;223;223$/u);
  });

  it.each(["vertical", "horizontal"])("paints dark's two bars in its own palette, #3498db and #2ecc71 (%s)", (orientation) => {
    const out = renderThemed(chart(orientation), { width: 80, background: "dark" }, "dark");
    expect(codes(out, BAR_RE)).toEqual(new Set(["38;2;52;152;219", "38;2;46;204;113"]));
  });

  it.each(["vertical", "horizontal"])("reads themeVariables.xyChart.plotColorPalette, one seat for both plots (%s)", (orientation) => {
    const head = '  theme: base\n  themeVariables:\n    xyChart:\n      plotColorPalette: "#4dabf7"\n';
    const out = renderThemed(chart(orientation, head), { width: 80, background: "light" }, "base");
    expect(codes(out, BAR_RE)).toEqual(new Set(["38;2;77;171;247"]));
  });

  it.each(["vertical", "horizontal"])("leaves a plotColorPalette written at the top of themeVariables unread, as mermaid does (%s)", (orientation) => {
    const head = '  theme: base\n  themeVariables:\n    plotColorPalette: "#4dabf7"\n';
    const out = renderThemed(chart(orientation, head), { width: 80, background: "dark" }, "base");
    expect(codes(out, BAR_RE)).not.toContain("38;2;77;171;247");
  });

  it.each(["vertical", "horizontal"])("reads plotColorPalette from an init directive's xyChart section (%s)", (orientation) => {
    const init = '%%{init: {"theme": "base", "themeVariables": {"xyChart": {"plotColorPalette": "#4dabf7"}}}}%%\n';
    const out = renderThemed(chart(orientation).replace("xychart-beta", init + "xychart-beta"), { width: 80, background: "light" }, "base");
    expect(codes(out, BAR_RE)).toEqual(new Set(["38;2;77;171;247"]));
  });

  it("paints a line in its own seat, after the bars", () => {
    const out = renderThemed(chart("vertical").replace("bar [2, 4, 6]", "line [2, 4, 6]"), { width: 80, background: "dark" }, "redux-dark");
    expect(codes(out, BAR_RE)).toEqual(new Set(["38;2;255;244;221"]));
    expect(out).toMatch(/\[38;2;255;216;177m[\u2801-\u28ff]/u);
  });
});

// `mono` is ours: its plots take greys, light and dark by turns as its pie slices do, never the default orange.
describe("mono's xychart", () => {
  it.each(["vertical", "horizontal"])("paints its two bars in two distinct greys (%s)", (orientation) => {
    const bars = [...codes(renderThemed(chart(orientation), { width: 80, background: "dark" }, "mono"), BAR_RE)];
    expect(bars).toHaveLength(2);
    for (const bar of bars) expect(bar).toMatch(/38;2;(\d+);\1;\1$/u);
  });
});
