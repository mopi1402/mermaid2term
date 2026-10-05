// A class family with no root (a cycle) ranks from layer 0 beside the others, as the graph engine's `layerTree`
// and mermaid's dagre rank it, instead of one trailing layer under everything.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const rows = (drawn: string): string[] => drawn.split("\n");
// The name's row, whichever wall a relation tees into there.
const rowOf = (drawn: string, name: string): number => rows(drawn).findIndex((line) => new RegExp(`[│├┤]      ${name}       [│├┤]`, "u").test(line));
const colOf = (drawn: string, name: string): number => rows(drawn)[rowOf(drawn, name)].indexOf(`      ${name}       `);

describe("class rootless family rank", () => {
  it("TB puts C beside A and D beside B", () => {
    const drawn = render("classDiagram\n  direction TB\n  A <|-- B\n  C --> D\n  D --> C", { width: 80 });
    expect(rowOf(drawn, "C")).toBe(rowOf(drawn, "A"));
    expect(rowOf(drawn, "D")).toBe(rowOf(drawn, "B"));
  });

  it("LR in a namespace lays C and D in the columns of A and B", () => {
    const drawn = render(
      "classDiagram\n  direction LR\n  namespace N {\n    class A\n    class B\n    class C\n    class D\n  }\n  A <|-- B\n  C --> D\n  D --> C",
      { width: 80 }
    );
    expect(colOf(drawn, "C")).toBe(colOf(drawn, "A"));
    expect(colOf(drawn, "D")).toBe(colOf(drawn, "B"));
    expect(rowOf(drawn, "C")).toBe(rowOf(drawn, "D"));
  });
});
