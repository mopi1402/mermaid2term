import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, "timeline\n  section Early\n    2002 : LinkedIn\n  section Late\n    2005 : YouTube\n"),
    { width, background: "light" },
    "default"
  );

// Across at 100 columns, turned down at 20.
const widths = [20, 100];

// Measured on mermaid 12.0.0 headless: `.section-N path` fills section N's boxes, numbered from -1, and
// `.eventWrapper` reaches an event's font past the box's own fill.
describe("a timeline's own selectors in themeCSS", () => {
  it.each(widths)("`.section--1 path` paints the first section's period, not the second's (width %i)", (width) => {
    const text = drawn(".section--1 path { fill: #ff0000; }", width);
    expect(runOf(text, "2002")).toContain("38;2;255;0;0");
    expect(runOf(text, "2005")).not.toContain("38;2;255;0;0");
  });

  it.each(widths)("`.eventWrapper` bolds an event (width %i)", (width) => {
    const text = drawn(".eventWrapper { font-weight: bold; fill: #ff0000; }", width);
    expect(runOf(text, "LinkedIn")).toMatch(/^1;|;1;|^1$/u);
    expect(runOf(text, "LinkedIn")).not.toContain("38;2;255;0;0");
  });

  it("`.section-N path` grounds a header's band and `.section-N text` inks its name, across", () => {
    const text = drawn(".section-0 path { fill: #ffff00; } .section-0 text { fill: #00aa00; }", 100);
    expect(runOf(text, "Late")).toContain("48;2;255;255;0");
    expect(runOf(text, "Late")).toContain("38;2;0;170;0");
    expect(runOf(text, "Early")).not.toContain("48;2;255;255;0");
  });
});
