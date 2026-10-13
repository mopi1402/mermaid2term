import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, "mindmap\n  root((Root))\n    A[Square]\n      A1(Round)\n    B(Rounded)\n      B1[Leaf]\n    C\n"),
    { width, background: "light" },
    "default"
  );

// Measured on mermaid 12.0.0 headless: `.section-0 rect` fills the first branch's square and rounded shapes,
// `.section-1 span` colours the second branch's words, where its `fill` does nothing, `.section-root circle` fills the
// root and `.edge` strokes every edge.
describe("a mindmap's own selectors in themeCSS", () => {
  it.each([30, 100])("a branch's shape and words take `.section-N rect` and `span` (width %i)", (width) => {
    const text = drawn(".section-0 rect { fill: #ff0000; } .section-1 span { color: #0000ff; } .section-0 span { fill: #00ffff; }", width);
    expect(runOf(text, "Square")).toContain("48;2;255;0;0");
    expect(runOf(text, "Round ")).toContain("48;2;255;0;0");
    expect(runOf(text, "Leaf")).toContain("38;2;0;0;255");
    expect(runOf(text, "Square")).not.toContain("38;2;0;255;255");
  });

  it.each([30, 100])("the root takes `.section-root circle` and every edge `.edge` (width %i)", (width) => {
    const text = drawn(".section-root circle { fill: #00aa00; } .edge { stroke: #ff00ff; }", width);
    expect(runOf(text, "Root")).toContain("48;2;0;170;0");
    expect(text).toMatch(/38;2;255;0;255m[─│]/u);
  });

  // Measured on mermaid 12.0.0 headless: each rule reaches the shapes mermaid draws with its element, and no other.
  const SHAPED = withConfig({ themeCSS: '"RULES"' }, "mindmap\n  root[Top]\n    A[Square]\n      H{{Hexa}}\n      O((Circ))\n      C)Cloud(\n      Plain\n");
  const shapedAt = (css: string, width: number): string =>
    renderThemed(SHAPED.replace("RULES", css), { width, background: "light" }, "default");
  const RED = "48;2;255;0;0";

  it.each([
    [".section-0 rect", ["Square"]],
    [".section-0 polygon", ["Hexa"]],
    [".section-0 circle", ["Circ"]],
    [".section-0 path", ["Cloud", "Plain"]],
    [".section-root rect", ["Top"]],
  ])("`%s` grounds the shapes drawn with its element alone", (selector, reached) => {
    for (const width of [30, 100]) {
      const text = shapedAt(`${selector} { fill: #ff0000; }`, width);
      for (const word of ["Top", "Square", "Hexa", "Circ", "Cloud", "Plain"]) expect([word, runOf(text, word).includes(RED)]).toEqual([word, reached.includes(word)]);
    }
  });

  it.each([30, 100])("`.section-root circle` leaves a square root alone (width %i)", (width) => {
    expect(runOf(shapedAt(".section-root circle { fill: #ff0000; }", width), "Top")).not.toContain(RED);
  });
});
