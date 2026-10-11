import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number, bars: string): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, `xychart-beta\n  title "Sales"\n  x-axis [jan, feb, mar]\n  y-axis "Revenue" 0 --> 100\n  ${bars}\n`),
    { width, background: "light" },
    "default"
  );

// Measured on mermaid 12.0.0 headless: `.chart-title text` inks the title; a bare `.chart-title` loses to the attribute.
describe("an XY chart's own selectors in themeCSS", () => {
  it.each([
    [60, "bar [20, 50, 80]"],
    [120, "bar [20, 50, 80]\n  line [30, 60, 40]"],
  ])("`.chart-title text` inks the title (width %i)", (width, bars) => {
    const text = drawn(".chart-title text { fill: #ff0000; } .chart-title { fill: #00aa00; }", width, bars);
    expect(runOf(text, "Sales")).toContain("38;2;255;0;0");
    expect(runOf(text, "Revenue")).not.toContain("38;2;255;0;0");
  });
});
