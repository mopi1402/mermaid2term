// A run mermaid's lexer finds too short is read as the long run it stands for, never refused nor turned into a node:
// `A <-- B` as `A <--- B`, `A -- B` as `A --- B`, `A <--|x| B` as `A <---|x| B` and not with a head at each end.

import { describe, expect, it } from "vitest";

import { ArrowType, EdgeStyle } from "../../src/graph/model.js";
import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";

const READ: ReadonlyArray<readonly [string, string, EdgeStyle, ArrowType | undefined, ArrowType | undefined]> = [
  ["A <-- B", "", EdgeStyle.SOLID, undefined, undefined],
  ["A <---|x| B", "x", EdgeStyle.SOLID, ArrowType.ARROW, undefined],
  ["A <--|x| B", "x", EdgeStyle.SOLID, ArrowType.ARROW, undefined],
  ["A <-- x -- B", "x", EdgeStyle.SOLID, ArrowType.ARROW, undefined],
  ["A <-. B", "", EdgeStyle.DOTTED, undefined, undefined],
  ["A <== B", "", EdgeStyle.THICK, undefined, undefined],
  ["A x-- B", "", EdgeStyle.SOLID, undefined, undefined],
  ["A -. B", "", EdgeStyle.DOTTED, undefined, undefined],
  ["A -- B", "", EdgeStyle.SOLID, undefined, undefined],
  ["A -- x -- B", "x", EdgeStyle.SOLID, undefined, undefined],
  ["A --|x| B", "x", EdgeStyle.SOLID, undefined, ArrowType.ARROW],
  ["A[a -- b] --> B", "", EdgeStyle.SOLID, undefined, ArrowType.ARROW],
  ["A(x -- y) --- B", "", EdgeStyle.SOLID, undefined, undefined],
];

describe.each(["TD", "LR"])("a short link read as its long form, %s", (direction) => {
  it.each(READ)("reads `%s`", (line, label, style, start, end) => {
    const graph = parseFlowchart(`flowchart ${direction}\n  ${line}`);
    expect(graph.edges).toHaveLength(1);
    const [edge] = graph.edges;
    expect([edge.source, edge.target]).toEqual(["A", "B"]);
    expect(edge.label).toBe(label);
    expect(edge.style).toBe(style);
    expect(edge.hasArrowStart ? edge.arrowTypeStart : undefined).toBe(start);
    expect(edge.hasArrowEnd ? edge.arrowTypeEnd : undefined).toBe(end);
  });
});
