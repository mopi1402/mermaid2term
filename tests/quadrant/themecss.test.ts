import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, "quadrantChart\n  title Reach\n  x-axis Low --> High\n  y-axis Bad --> Good\n  quadrant-1 Expand\n  quadrant-2 Promote\n  Campaign A: [0.3, 0.6]\n"),
    { width, background: "light" },
    "default"
  );

// Measured on mermaid 12.0.0 headless: a bare `.data-point` fills the dot, and the descendant rules reach the rest.
describe("a quadrant chart's own selectors in themeCSS", () => {
  it.each([50, 100])("`.quadrant rect` grounds a quadrant and what stands on it (width %i)", (width) => {
    const text = drawn(".quadrant rect { fill: #ffcc00; }", width);
    expect(runOf(text, "Expand")).toContain("48;2;255;204;0");
    expect(runOf(text, "Campaign A")).toContain("48;2;255;204;0");
  });

  it.each([50, 100])("the point, the names and the titles take their inks (width %i)", (width) => {
    const css = ".quadrant text { fill: #00aa00; } .data-point { fill: #ff0000; } .data-point text { fill: #0000ff; } .label text { fill: #aa00aa; } .title text { fill: #00aaaa; }";
    const text = drawn(css, width);
    expect(runOf(text, "Promote")).toContain("38;2;0;170;0");
    expect(runOf(text, "●")).toContain("38;2;255;0;0");
    expect(runOf(text, "Campaign")).toContain("38;2;0;0;255");
    expect(runOf(text, "Good")).toContain("38;2;170;0;170");
    expect(runOf(text, "Reach")).toContain("38;2;0;170;170");
  });
});
