import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, `treemap-beta\n"Root"\n    "A"\n        "a1": 10\n        "a2": 20\n    "B": 15\n`),
    { width, background: "light" },
    "default"
  );

// Measured on mermaid 12.0.0 headless: `.treemapLeaf` strokes a leaf's box, `.treemapSection` a branch's.
describe("a treemap's own selectors in themeCSS", () => {
  it.each([60, 100])("`.treemapLeaf` inks a leaf's box and `.treemapSection` a branch's (width %i)", (width) => {
    const text = drawn(".treemapLeaf { stroke: #00aa00; } .treemapSection { stroke: #0000ff; }", width);
    expect(runOf(text, "─")).toContain("38;2;0;170;0");
    expect(runOf(text, "┄")).toContain("38;2;0;0;255");
  });
});
