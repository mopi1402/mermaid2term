// A link head `o` or `x` glued to the next id is a head, as mermaid's LINK token `[xo<]?--+[-xo>]` reads it:
// `A--oC` links A to C with a circle, `A---xE` with a cross; `A --- oB` keeps its blank and reaches a node `oB`.

import { describe, expect, it } from "vitest";

import { ArrowType, EdgeStyle } from "../../src/graph/model.js";
import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { renderThemedText } from "../../src/index.js";

type Read = readonly [string, string, string, EdgeStyle, ArrowType | undefined, ArrowType | undefined, string];

const READ: ReadonlyArray<Read> = [
  ["A--oC", "A", "C", EdgeStyle.SOLID, undefined, ArrowType.CIRCLE, ""],
  ["A---xE", "A", "E", EdgeStyle.SOLID, undefined, ArrowType.CROSS, ""],
  ["A---oB", "A", "B", EdgeStyle.SOLID, undefined, ArrowType.CIRCLE, ""],
  ["A-.-oB", "A", "B", EdgeStyle.DOTTED, undefined, ArrowType.CIRCLE, ""],
  ["A-.-xB", "A", "B", EdgeStyle.DOTTED, undefined, ArrowType.CROSS, ""],
  ["A==oB", "A", "B", EdgeStyle.THICK, undefined, ArrowType.CIRCLE, ""],
  ["A==xB", "A", "B", EdgeStyle.THICK, undefined, ArrowType.CROSS, ""],
  ["A-- text --oB", "A", "B", EdgeStyle.SOLID, undefined, ArrowType.CIRCLE, "text"],
  ["A---ox", "A", "x", EdgeStyle.SOLID, undefined, ArrowType.CIRCLE, ""],
  ["Foo--oBar", "Foo", "Bar", EdgeStyle.SOLID, undefined, ArrowType.CIRCLE, ""],
  ["Ax==xB", "Ax", "B", EdgeStyle.THICK, undefined, ArrowType.CROSS, ""],
  ["A --- oB", "A", "oB", EdgeStyle.SOLID, undefined, undefined, ""],
  ["A --- xB", "A", "xB", EdgeStyle.SOLID, undefined, undefined, ""],
  ["A --- o", "A", "o", EdgeStyle.SOLID, undefined, undefined, ""],
  ["A o--o B", "A", "B", EdgeStyle.SOLID, ArrowType.CIRCLE, ArrowType.CIRCLE, ""],
];

describe.each(["TD", "LR"])("a head glued to the next id, %s", (direction) => {
  it.each(READ)("reads `%s`", (line, source, target, style, start, end, label) => {
    const graph = parseFlowchart(`flowchart ${direction}\n  ${line}`);
    expect(graph.edges).toHaveLength(1);
    const [edge] = graph.edges;
    expect([edge.source, edge.target]).toEqual([source, target]);
    expect(edge.label).toBe(label);
    expect(edge.style).toBe(style);
    expect(edge.hasArrowStart ? edge.arrowTypeStart : undefined).toBe(start);
    expect(edge.hasArrowEnd ? edge.arrowTypeEnd : undefined).toBe(end);
  });

  it("chains `A--oB--xC` as two headed links", () => {
    const graph = parseFlowchart(`flowchart ${direction}\n  A--oB--xC`);
    expect(graph.edges.map((e) => [e.source, e.target, e.arrowTypeEnd])).toEqual([
      ["A", "B", ArrowType.CIRCLE],
      ["B", "C", ArrowType.CROSS],
    ]);
  });

  it("draws three nodes A, B, C, E with a circle and a cross head", () => {
    const { plain } = renderThemedText(`flowchart ${direction}\nA--oC\nA---xE\nA---oB`);
    expect(plain).not.toMatch(/A--oC|xE|oB/u);
    expect(plain).toContain("●");
    expect(plain).toContain("×");
  });
});
