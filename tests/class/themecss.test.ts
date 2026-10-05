import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, direction: string): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, `classDiagram\n  direction ${direction}\n  class Animal {\n    +String name\n  }\n  Animal <|-- Dog : inherits\n  note for Dog "a remark"\n`),
    { width: 100, background: "light" },
    "default"
  );

// Measured on mermaid 12.0.0 headless: `.relation` strokes the lines, `.markdown-node-label` colours a box's words,
// `.noteLabel .nodeLabel` a note's and `.edgeLabel .label span` a relation label's.
describe("a class diagram's own selectors in themeCSS", () => {
  it.each(["TB", "LR"])("`.relation` inks every line (%s)", (direction) => {
    expect(drawn(".relation { stroke: #ff0000; }", direction)).toMatch(/38;2;255;0;0[0-9;]*m[─│┄┆╭╮╰╯┌┐└┘]/u);
  });

  it.each(["TB", "LR"])("the words of a box, a note and a relation label take their colour (%s)", (direction) => {
    const text = drawn(
      ".markdown-node-label { color: #ff0000; } .noteLabel .nodeLabel { color: #00aa00; } .edgeLabel .label span { color: #0000cc; }",
      direction
    );
    expect(runOf(text, "Animal")).toContain("38;2;255;0;0");
    expect(runOf(text, "name")).toContain("38;2;255;0;0");
    expect(runOf(text, "remark")).toContain("38;2;0;170;0");
    expect(runOf(text, "inherits")).toContain("38;2;0;0;204");
  });
});
