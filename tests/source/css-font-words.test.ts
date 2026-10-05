import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";

// mermaid 12 lays a node's `font-weight`, `font-style` and `text-decoration` on its text: a class's name and members,
// a flowchart node's label. The terminal says them with SGR bold, italic and underline.
const styleOf = (source: string, word: string): readonly string[] => {
  const text = renderThemedText(source, { width: 80, background: "light" }, "default");
  const row = text.rows.find((cells) => cells.map((cell) => cell.ch).join("").includes(word)) ?? [];
  const at = row.map((cell) => cell.ch).join("").indexOf(word);
  return row.slice(at, at + word.length).map((cell) => cell.style);
};
const says = (styles: readonly string[], word: string): boolean => styles.length > 0 && styles.every((style) => style.split(" ").includes(word));

const classSource = (direction: string, style: string): string =>
  `classDiagram\n  direction ${direction}\n  class Order {\n    +int id\n  }\n  class Invoice {\n    +int id\n  }\n  Order --> Invoice\n  style Order ${style}`;

describe.each(["TB", "LR"])("a class's font properties reach its name and members, %s", (direction) => {
  it.each([
    ["font-weight:bold", "bold"],
    ["font-style:italic", "italic"],
    ["text-decoration:underline", "underline"],
  ])("%s", (style, word) => {
    const source = classSource(direction, `fill:#ffffff,${style}`);
    expect(says(styleOf(source, "Order"), word)).toBe(true);
    expect(says(styleOf(source, "+int"), word)).toBe(true);
  });

  it("leaves the other class as it was", () => {
    const source = classSource(direction, "fill:#ffffff,font-style:italic,text-decoration:underline");
    expect(styleOf(source, "Invoice").some((style) => style.includes("italic") || style.includes("underline"))).toBe(false);
  });
});

describe.each(["TD", "LR"])("a flowchart node's text-decoration underlines its label, %s", (direction) => {
  it("underline", () => {
    const source = `flowchart ${direction}\n  A[Order] --> B[Invoice]\n  style A text-decoration:underline`;
    expect(says(styleOf(source, "Order"), "underline")).toBe(true);
    expect(says(styleOf(source, "Invoice"), "underline")).toBe(false);
  });
});

describe.each(["TD", "LR"])("a node filled with no stroke keeps the theme's outline, %s", (direction) => {
  const chars = (source: string): string =>
    renderThemedText(source, { width: 80, background: "light" }, "default").rows.map((cells) => cells.map((cell) => cell.ch).join("")).join("\n");
  it.each(["style A fill:#ffd6d6", "classDef hot fill:#ffd6d6\n  class A hot"])("%s", (style) => {
    const bare = `flowchart ${direction}\n  A[Order] --> B[Invoice]`;
    expect(chars(`${bare}\n  ${style}`)).toBe(chars(bare));
  });
});

describe.each(["LR", "TB"])("an underlined label is one run, the blanks between its words underlined too, %s", (direction) => {
  it.each([
    [`flowchart ${direction}\n  A[Order total] --> B[Invoice]\n  style A text-decoration:underline`, "Order total"],
    [`classDiagram\n  direction ${direction}\n  class Order {\n    +total() float\n  }\n  style Order fill:#ffffff,text-decoration:underline`, "+total() : float"],
  ])("%s", (source, words) => {
    expect(says(styleOf(source, words), "underline")).toBe(true);
  });
});

describe.each(["TB", "LR"])("an ER entity's font properties reach its name and attributes, %s", (direction) => {
  const erSource = (style: string): string =>
    `erDiagram\n  direction ${direction}\n  ORDER {\n    int total\n  }\n  INVOICE {\n    int number\n  }\n  ORDER ||--o{ INVOICE : bills\n  style ORDER ${style}`;
  it.each([
    ["font-weight:bold", "bold"],
    ["font-style:italic", "italic"],
    ["text-decoration:underline", "underline"],
  ])("%s", (style, word) => {
    const source = erSource(`fill:#ffffff,${style}`);
    expect(says(styleOf(source, "ORDER"), word)).toBe(true);
    expect(says(styleOf(source, "total"), word)).toBe(true);
    expect(says(styleOf(source, "number"), word)).toBe(false);
  });
});
