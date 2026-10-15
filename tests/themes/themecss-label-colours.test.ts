import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runsOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, body: string): string =>
  renderThemed(withConfig({ themeCSS: `"${css}"` }, body), { width: 100, background: "light" }, "default");

const runOf = (text: string, word: string): string =>
  runsOf(text).find(([, run]) => run.trim() === word)?.[0] ?? "";

const RED = "38;2;255;0;0";
const GREEN = "38;2;0;255;0";
const BLUE_GROUND = "48;2;0;0;255";
const DIRECTIONS = ["TD", "LR"];

const flowchart = (direction: string): string =>
  `flowchart ${direction}\n  classDef hot color:#123456\n  classDef warm fill:#ffeeaa\n  A[Alpha] -->|yes| B[Beta]\n  B --> C[Gamma]:::hot\n  B -->|no| D[Delta]\n  E[Eps]:::warm\n  style B color:#654321\n  subgraph S[Sub]\n  D\n  end\n  linkStyle 2 color:#abcdef\n`;

// Measured on mermaid 12.0.0 headless: a `color` on `.nodeLabel` or `.edgeLabel` reaches the words past mermaid's own
// sheet, a `classDef`, `style` or `linkStyle` colour still wins, and the ground shows only where `.edgeLabel p` is not
// grounded over it.
describe("a themeCSS colour on the label selectors", () => {
  it.each(DIRECTIONS)("`.nodeLabel` inks a flowchart's node words, under a classDef or style colour (%s)", (direction) => {
    const text = drawn(".nodeLabel { color: #ff0000; }", flowchart(direction));
    for (const word of ["Alpha", "Delta", "Eps"]) expect(runOf(text, word)).toContain(RED);
    expect(runOf(text, "Alpha")).toMatch(/^1;/u);
    expect(runOf(text, "Beta")).toContain("38;2;101;67;33");
    expect(runOf(text, "Gamma")).toContain("38;2;18;52;86");
    expect(runOf(text, "Sub")).not.toContain(RED);
    expect(runOf(text, "yes")).not.toContain(RED);
  });

  it.each(DIRECTIONS)("`.edgeLabel` inks a flowchart's edge label, under a linkStyle colour (%s)", (direction) => {
    const text = drawn(".edgeLabel { color: #00ff00; }", flowchart(direction));
    expect(runOf(text, "yes")).toMatch(/38;2;0;1[0-9]{2};0/u);
    expect(runOf(text, "no")).not.toMatch(/38;2;0;1[0-9]{2};0/u);
    expect(runOf(text, "Alpha")).not.toMatch(/38;2;0;1[0-9]{2};0/u);
  });

  it.each(DIRECTIONS)("`.edgeLabel p` grounds a flowchart's edge label, `.edgeLabel` does not (%s)", (direction) => {
    expect(runOf(drawn(".edgeLabel p { background-color: #0000ff; }", flowchart(direction)), "yes")).toContain(BLUE_GROUND);
    expect(runOf(drawn(".edgeLabel { background-color: #0000ff; }", flowchart(direction)), "yes")).not.toContain(BLUE_GROUND);
  });

  it.each(DIRECTIONS)("`.nodeLabel` inks a state's name and a composite's title, `.edgeLabel` misses its label (%s)", (direction) => {
    const body = `stateDiagram-v2\n  direction ${direction === "TD" ? "TB" : "LR"}\n  A --> B: yes\n  state G {\n  D\n  }\n`;
    const text = drawn(".nodeLabel { color: #ff0000; } .edgeLabel { color: #00ff00; }", body);
    for (const word of ["A", "B", "G", "D"]) expect(runOf(text, word)).toContain(RED);
    expect(runOf(text, "yes")).not.toContain(GREEN);
    expect(runOf(drawn(".edgeLabel p { color: #00ff00; }", body), "yes")).toMatch(/38;2;0;1[0-9]{2};0/u);
  });

  it.each(DIRECTIONS)("`.nodeLabel` inks a class box under its style, a relation label keeping its own ink (%s)", (direction) => {
    const body = `classDiagram\n  direction ${direction === "TD" ? "TB" : "LR"}\n  class Alpha\n  class Beta\n  Alpha --> Beta : uses\n  style Beta color:#654321\n`;
    const text = drawn(".nodeLabel { color: #ff0000; }", body);
    expect(runOf(text, "Alpha")).toContain(RED);
    expect(runOf(text, "Beta")).toContain("38;2;101;67;33");
    expect(runOf(text, "uses")).not.toContain(RED);
    expect(runOf(drawn(".edgeLabel { color: #00ff00; }", body), "uses")).toMatch(/38;2;0;1[0-9]{2};0/u);
  });

  it.each(DIRECTIONS)("`.edgeLabel` inks and grounds an ER relationship label, `.nodeLabel` its entities (%s)", (direction) => {
    const body = `erDiagram\n  direction ${direction === "TD" ? "TB" : "LR"}\n  CUSTOMER ||--o{ ORDER : places\n`;
    const text = drawn(".nodeLabel { color: #ff0000; } .edgeLabel { color: #00ff00; background-color: #0000ff; }", body);
    expect(runOf(text, "CUSTOMER")).toContain(RED);
    expect(runOf(text, "places")).toContain(GREEN);
    expect(runOf(text, "places")).toContain(BLUE_GROUND);
  });

  it("`.nodeLabel` and `.edgeLabel` ink a block's words, under a classDef or style colour", () => {
    const body = "block-beta\n  columns 3\n  A B C\n  A --\"yes\"--> B\n  classDef hot color:#123456\n  class C hot\n  style B color:#654321\n";
    const text = drawn(".nodeLabel { color: #ff0000; } .edgeLabel { color: #00ff00; }", body);
    expect(runOf(text, "A")).toContain(RED);
    expect(runOf(text, "B")).toContain("38;2;101;67;33");
    expect(runOf(text, "C")).toContain("38;2;18;52;86");
    expect(runOf(text, "yes")).toContain(GREEN);
  });
});
