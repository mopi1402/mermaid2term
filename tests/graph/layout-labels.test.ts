import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { sgr } from "../../src/paint/escapes.js";
import { widest } from "../support/drawn.js";

describe("a `<br>` in a node label, a line break and never a shape delimiter", () => {
  const SPELLINGS = ["<br>", "<br/>", "<br />", "<BR>"];

  it.each(SPELLINGS)("keeps both halves of a flowchart label written with %s", (tag) => {
    const drawn = render(`flowchart TD\n    A[source${tag}and more] --> B[render]\n`, { width: 80 });
    expect(drawn).toContain("source");
    expect(drawn).toContain("and more");
  });

  it.each(SPELLINGS)("leaves the rectangle a rectangle, written with %s", (tag) => {
    const drawn = render(`flowchart TD\n    A[source${tag}and more] --> B[render]\n`, { width: 80 });
    expect(drawn).not.toContain("\u27e9");
    expect(drawn).not.toContain(">  ");
  });

  it("draws the two halves on two rows, the way the literal `\\n` already did", () => {
    const tagged = render("flowchart TD\n    A[source<br>and more] --> B[render]\n", { width: 80 });
    expect(tagged).toBe(render("flowchart TD\n    A[source\\nand more] --> B[render]\n", { width: 80 }));
  });

  it("reads it inside a quoted label too, where the quotes used to be what rescued it", () => {
    const drawn = render('flowchart TD\n    A["source<br>and more"] --> B[render]\n', { width: 80 });
    expect(drawn).toContain("source");
    expect(drawn).toContain("and more");
  });

  it.each(SPELLINGS)("keeps both halves of a block-beta label written with %s", (tag) => {
    const drawn = render(`block-beta\n    columns 2\n    A["source${tag}and more"] B["two"]\n`, { width: 80 });
    expect(drawn).toContain("source");
    expect(drawn).toContain("and more");
    expect(drawn).not.toContain('"');
  });

  it("turns it in a diamond and every other shape, the tag going before the delimiters are read", () => {
    const drawn = render("flowchart TD\n    A{ok<br>done} --> B([go<br>on])\n", { width: 80 });
    for (const half of ["ok", "done", "go", "on"]) expect(drawn).toContain(half);
  });
});

describe("a node label folded for the budget and not at a flat twenty whatever the width", () => {
  const source = "flowchart\n    A{binaire present} -->|oui| B[dessine]\n    A -->|non| C[texte brut]\n";

  it("folds what binds and comes in under the budget, every word kept", () => {
    const drawn = render(source, { width: 30 });
    expect(widest(drawn)).toBeLessThanOrEqual(30);
    for (const word of ["binaire", "present", "dessine", "texte brut"]) expect(drawn).toContain(word);
    expect(drawn).not.toContain("binaire present");
  });

  it("leaves a drawing that fits alone, every label on the one line the author wrote", () => {
    expect(render(source, { width: 200 })).toContain("binaire present");
  });

  it("spends the gap and the padding before it touches a word of the author's", () => {
    expect(render(source, { width: 40 })).toContain("binaire present");
  });

  it("keeps every label whole where `autoWrap` vetoes the fold, whatever the overflow costs", () => {
    expect(render(source, { width: 30, autoWrap: false })).toContain("binaire present");
  });

  it("never hands a folded label back whole as the pane narrows, the ladder being one chain", () => {
    const cicd =
      "graph\n    A[Push] --> B[Build]\n    B --> C[Test]\n    C --> D{Pass?}\n" +
      "    D -->|Yes| E[Deploy Staging]\n    D -->|No| F[Notify]\n    E --> G{Approve?}\n" +
      "    G -->|Yes| H[Deploy Prod]\n    G -->|No| F\n    H --> I{Healthy?}\n" +
      "    I -->|Yes| J[Done]\n    I -->|No| F\n";
    let whole = true;
    for (let width = 120; width >= 92; width--) {
      const now = render(cicd, { width }).includes("Deploy Staging");
      expect(now && !whole).toBe(false);
      whole = now;
    }
  });
});

describe("a themed row holding a wide character, painted cell for cell", () => {
  const NODE = sgr("36");
  const EDGE = sgr("2", "37");
  const ARROW = sgr("1", "33");
  const WIDE: ReadonlyArray<readonly [string, string]> = [
    ["an emoji", "flowchart LR\n    A[🚀 ship it] --> B[ok]\n"],
    ["an ideograph", "flowchart LR\n    A[日本語 done] --> B[ok]\n"],
    ["two of them", "flowchart LR\n    A[🚀 日本語 ✅] --> B[ok]\n"],
  ];

  it.each(WIDE)("gives the head of the arrow the arrow's own colour, past %s", (_what, source) => {
    const painted = renderThemed(source, { width: 80 }, "classic");
    expect(painted).toContain(`${ARROW}⏵`);
    expect(painted).not.toContain(`${EDGE}⏵`);
  });

  it.each(WIDE)("paints nothing at all but a head with the arrow's colour, past %s", (_what, source) => {
    const painted = renderThemed(source, { width: 80 }, "classic");
    const heads = (render(source, { width: 80 }).match(/⏵/gu) ?? []).length;
    const wearing = painted.match(/\u001b\[1;33m./gu) ?? [];
    expect(heads).toBeGreaterThan(0);
    expect(wearing).toHaveLength(heads);
    for (const cell of wearing) expect(cell.endsWith("⏵")).toBe(true);
  });

  it.each(WIDE)("paints the border the edge leaves from, rather than leaving it bare, past %s", (_what, source) => {
    const painted = renderThemed(source, { width: 80, look: "classic" }, "classic");
    expect(painted).toContain(`${NODE}├`);
  });
});
