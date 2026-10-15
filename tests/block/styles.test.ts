import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { aroundWord } from "../support/grid.js";

// mermaid 12 styles a block through `classDef`, `class` (before or after its `classDef`), `classDef default` and
// `style`, and fills every block with the theme's `mainBkg` (checked headless on 2026-09-28).
const cellsOf = (source: string, word: string) => aroundWord(renderThemedText(source, { width: 80, background: "light" }, "default"), word);
const has = (style: string | undefined, part: string): boolean => style?.toLowerCase().includes(part) === true;

// A block has no direction: one column stacks the blocks as TD would, three set them side by side as LR would.
describe.each([1, 3])("a block's styles, %i column(s)", (columns) => {
  const source = (styling: string): string => `block-beta\n  columns ${columns}\n  a["Order total"] b("Invoice") c{{"Refund"}}\n  ${styling}`;

  it("fills a block with the theme's mainBkg when nothing is written", () => {
    expect(has(cellsOf(source(""), "Invoice").before?.style, "on #ececff")).toBe(true);
  });

  it("lays a style's fill, stroke and color", () => {
    const { word, before, wall } = cellsOf(source("style a fill:#ffd6d6,stroke:#e03131,color:#b00000"), "Order");
    expect(has(before?.style, "on #ffd6d6")).toBe(true);
    expect(has(wall?.style, "#e03131")).toBe(true);
    expect(word.every((cell) => has(cell.style, "#b00000"))).toBe(true);
    expect(has(cellsOf(source("style a fill:#ffd6d6"), "Invoice").before?.style, "on #ececff")).toBe(true);
  });

  it("lays a class, written before its classDef or after, and fills a hexagon inside its outline", () => {
    for (const styling of ["classDef hot fill:#d6ffd6\n  class a,c hot", "class a,c hot\n  classDef hot fill:#d6ffd6"]) {
      expect(has(cellsOf(source(styling), "Order").before?.style, "on #d6ffd6")).toBe(true);
      expect(has(cellsOf(source(styling), "Refund").before?.style, "on #d6ffd6")).toBe(true);
      expect(has(cellsOf(source(styling), "Invoice").before?.style, "on #d6ffd6")).toBe(false);
    }
  });

  it("lays classDef default on every block", () => {
    for (const word of ["Order", "Invoice", "Refund"]) expect(has(cellsOf(source("classDef default fill:#fff4d6"), word).before?.style, "on #fff4d6")).toBe(true);
  });

  it("sets the label's font", () => {
    const { word } = cellsOf(source("style b font-style:italic,text-decoration:underline"), "Invoice");
    expect(word.every((cell) => has(cell.style, "italic") && has(cell.style, "underline"))).toBe(true);
  });
});
