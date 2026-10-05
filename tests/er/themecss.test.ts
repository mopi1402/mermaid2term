import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, direction: string): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, `erDiagram\n  direction ${direction}\n  CUSTOMER ||--o{ ORDER : places\n  ORDER ||--|{ LINE-ITEM : contains\n  CUSTOMER }|..|{ DELIVERY-ADDRESS : uses\n  CUSTOMER {\n    string name PK\n  }\n`),
    { width: 100, background: "light" },
    "default"
  );

// Measured on mermaid 12.0.0 headless: `.relationshipLine` strokes the lines, `.labelBkg` colours a relationship's
// label and `.label` every word the drawing writes.
describe("an ER diagram's own selectors in themeCSS", () => {
  it.each(["TB", "LR"])("`.relationshipLine` inks every line (%s)", (direction) => {
    expect(drawn(".relationshipLine { stroke: #ff0000; }", direction)).toMatch(/38;2;255;0;0[0-9;]*m[─│┄┆┊╭╮╰╯┌┐└┘]/u);
  });

  it.each(["TB", "LR"])("`.labelBkg` inks a relationship's label (%s)", (direction) => {
    const text = drawn(".labelBkg { color: #00aa00; }", direction);
    expect(runOf(text, "places")).toContain("38;2;0;170;0");
    expect(runOf(text, "CUSTOMER")).not.toContain("38;2;0;170;0");
  });

  it.each(["TB", "LR"])("`.label` inks every word (%s)", (direction) => {
    const text = drawn(".label { color: #ff0000; }", direction);
    for (const word of ["CUSTOMER", "ORDER", "name", "places"]) expect(runOf(text, word)).toContain("38;2;255;0;0");
  });
});
