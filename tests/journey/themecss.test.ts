import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, "journey\n  section Work\n    Tea: 5: Me\n  section Home\n    Sofa: 3: Me\n"),
    { width, background: "light" },
    "default"
  );

const widths = [40, 100];

// Measured on mermaid 12.0.0 headless: `.task` fills every task's box, `.task-type-N` the tasks of section N only.
describe("a journey's own selectors in themeCSS", () => {
  it.each(widths)("`.task` grounds every task (width %i)", (width) => {
    const text = drawn(".task { fill: #ff0000; }", width);
    expect(runOf(text, "Tea")).toContain("48;2;255;0;0");
    expect(runOf(text, "Sofa")).toContain("48;2;255;0;0");
  });

  it.each(widths)("`.task` leaves a section header on its own fill (width %i)", (width) => {
    const text = drawn(".task { fill: #ff0000; }", width);
    expect(runOf(text, "Work")).not.toContain("48;2;255;0;0");
    expect(runOf(text, "Work")).toContain("48;2;");
  });

  it.each(widths)("`.task-type-1` grounds the second section's tasks alone (width %i)", (width) => {
    const text = drawn(".task-type-1 { fill: #00aa00; }", width);
    expect(runOf(text, "Sofa")).toContain("48;2;0;170;0");
    expect(runOf(text, "Tea")).not.toContain("48;2;0;170;0");
  });
});
