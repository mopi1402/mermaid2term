import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";
import { aroundWord } from "../support/grid.js";

// mermaid 12 lays a node's `style` on its shape (`styles2String` hands the label the text properties alone), so
// `opacity` fades the shape and leaves the words; a class box is the exception, `classBox` laying the whole style on
// its words when it names no text property. A `classDef` reaches the words of every kind (`createCssStyles`, `> *`
// and `span`). The shape's colours are mixed with the page by the share that shows, a faded word with the ground it
// lies on: on a white page #ffd6d6 at 0.4 is #FFEFEF, #e03131 is #F3ADAD and at 0.2 #F9D6D6, and #333333 at 0.4 over
// #FFEFEF is #ADA4A4. A state's name is inked in `stateLabelColor` and a class's in `classText`, both #131300 under
// `default`, which is #A1978F at 0.4 over #FFEFEF.
const STYLE = "fill:#ffd6d6,stroke:#e03131";
// A kind, its directions, its source with a `style` on Order, its words' ink and that ink at 0.4, and whether that
// `style` reaches the words.
const KINDS: ReadonlyArray<readonly [string, readonly string[], (direction: string, style: string) => string, string, string, boolean]> = [
  ["flowchart", ["TD", "LR"], (d, s) => `flowchart ${d}\n  A[Order] --> B[Invoice]\n  style A ${s}`, "#333333", "#ADA4A4", false],
  ["state", ["TB", "LR"], (d, s) => `stateDiagram-v2\n  direction ${d}\n  Order --> Invoice\n  style Order ${s}`, "#131300", "#A1978F", false],
  ["class", ["TB", "LR"], (d, s) => `classDiagram\n  direction ${d}\n  class Order {\n    +int id\n  }\n  class Invoice\n  Order --> Invoice\n  style Order ${s}`, "#131300", "#A1978F", true],
  ["er", ["TB", "LR"], (d, s) => `erDiagram\n  direction ${d}\n  Order {\n    int id\n  }\n  Order ||--o{ Invoice : bills\n  style Order ${s}`, "#333333", "#ADA4A4", false],
  // A block has no direction: one column stacks as TD would, two set side by side as LR would.
  ["block", ["1", "2"], (d, s) => `block-beta\n  columns ${d}\n  a["Order"] b["Invoice"]\n  style a ${s}`, "#333333", "#ADA4A4", false],
];

// The same nodes worn through a `classDef`, which reaches the words of every kind.
const CLASSED: ReadonlyArray<readonly [string, readonly string[], (direction: string, style: string) => string, string]> = [
  ["flowchart", ["TD", "LR"], (d, s) => `flowchart ${d}\n  A[Order] --> B[Invoice]\n  classDef off ${s}\n  class A off`, "#ADA4A4"],
  ["state", ["TB", "LR"], (d, s) => `stateDiagram-v2\n  direction ${d}\n  Order --> Invoice\n  classDef off ${s}\n  class Order off`, "#A1978F"],
  ["block", ["1", "2"], (d, s) => `block-beta\n  columns ${d}\n  a["Order"] b["Invoice"]\n  classDef off ${s}\n  class a off`, "#ADA4A4"],
];

const cellsOf = (source: string) => {
  const { word, before, wall } = aroundWord(renderThemedText(source, { width: 80, background: "light" }, "default"), "Order");
  return { word: word[0]?.style ?? "", blank: before?.style ?? "", wall: wall?.style ?? "" };
};

describe.each(KINDS)("a %s node's opacities", (_kind, directions, source, ink, faded, worded) => {
  it.each(directions)("opacity fades the shape, the words as mermaid lays it, %s", (direction) => {
    const { word, blank, wall } = cellsOf(source(direction, `${STYLE},opacity:0.4`));
    expect(word.toLowerCase()).toContain(`${worded ? faded : ink} on #FFEFEF`.toLowerCase());
    expect(blank).toContain("on #FFEFEF");
    expect(wall).toContain("#F3ADAD");
  });

  it.each(directions)("fill-opacity fades the ground alone, %s", (direction) => {
    const { word, wall } = cellsOf(source(direction, `${STYLE},fill-opacity:40%`));
    expect(word.toLowerCase()).toContain(`${ink} on #ffefef`.toLowerCase());
    expect(wall.toLowerCase()).toContain("#e03131");
  });

  it.each(directions)("stroke-opacity fades the outline alone, %s", (direction) => {
    const { word, wall } = cellsOf(source(direction, `${STYLE},stroke-opacity:0.2`));
    expect(word.toLowerCase()).toContain(`${ink} on #ffd6d6`.toLowerCase());
    expect(wall).toContain("#F9D6D6");
  });
});

describe.each(CLASSED)("a %s node worn through a classDef", (_kind, directions, source, faded) => {
  it.each(directions)("opacity fades its words too, %s", (direction) => {
    const { word, blank } = cellsOf(source(direction, `${STYLE},opacity:0.4`));
    expect(word).toContain(`${faded} on #FFEFEF`);
    expect(blank).toContain("on #FFEFEF");
  });

  it.each(directions.flatMap((direction) => ["display:none", "visibility:hidden"].map((hiding) => [direction, hiding] as const)))("%s, %s hides its words too", (direction, hiding) => {
    expect(render(source(direction, `${STYLE},${hiding}`), { width: 80 })).not.toContain("Order");
  });
});

// `display: none` and `visibility: hidden` hide the shape, in plain text as in colour, and the words where the
// `style` reaches them; its edges are still drawn to where it stands, and its room is kept.
describe.each(KINDS)("a hidden %s node", (_kind, directions, source, _ink, _faded, worded) => {
  it.each(directions.flatMap((direction) => ["display:none", "visibility:hidden"].map((hiding) => [direction, hiding] as const)))("%s, %s", (direction, hiding) => {
    const shown = render(source(direction, STYLE), { width: 80 });
    const hidden = render(source(direction, `${STYLE},${hiding}`), { width: 80 });
    expect(shown).toContain("Order");
    if (worded) expect(hidden).not.toContain("Order");
    else expect(hidden).toContain("Order");
    expect(hidden).toContain("Invoice");
    const seat = (drawn: string): readonly [number, number] => {
      const rows = drawn.split("\n");
      const row = rows.findIndex((line) => line.includes("Invoice"));
      return [row, rows[row].indexOf("Invoice")];
    };
    expect(seat(hidden)).toEqual(seat(shown));
    const painted = renderThemedText(source(direction, `${STYLE},${hiding}`), { width: 80, background: "light" }, "default");
    expect(painted.rows.flat().some((cell) => cell.style.toLowerCase().includes("ffd6d6") || cell.style.toLowerCase().includes("e03131"))).toBe(false);
  });
});
