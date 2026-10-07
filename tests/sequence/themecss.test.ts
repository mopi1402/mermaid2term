import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, "sequenceDiagram\n  A->>B: hello\n  loop Every day\n    B->>A: ping\n  end\n"),
    { width, background: "light" },
    "default"
  );

const widths = [40, 100];

// Measured on mermaid 12.0.0 headless: `.messageText` inks a message's label, `.labelText` a block's keyword and
// `.labelBox` fills its tab, where neither `color` nor `font-weight` shows on the text.
describe("a sequence's own selectors in themeCSS", () => {
  it.each(widths)("`.messageText` and `.labelText` ink their words (width %i)", (width) => {
    const text = drawn(".messageText { fill: #ff0000; } .labelText { fill: #00aa00; }", width);
    expect(runOf(text, "hello")).toContain("38;2;255;0;0");
    expect(runOf(text, "loop")).toContain("38;2;0;170;0");
  });

  it.each(widths)("`.labelBox` grounds the tab (width %i)", (width) => {
    const text = drawn(".labelBox { fill: #ffff00; stroke: #ff0000; }", width);
    expect(runOf(text, "loop")).toContain("48;2;255;255;0");
    expect(runOf(text, "Every")).toContain("48;2;255;255;0");
    expect(runOf(text, "loop")).not.toContain("38;2;255;0;0");
  });

  it.each(widths)("`color` and `font-weight` leave a message's label as it was (width %i)", (width) => {
    expect(drawn(".messageText { color: #ff0000; font-weight: bold; }", width)).toBe(drawn("", width));
  });
});
