import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { parseBlockDiagram } from "../../src/diagrams/blockdiagram/parser.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { ArrowType, EdgeStyle } from "../../src/graph/model.js";
import { NodeShape } from "../../src/graph/shapes.js";
import type { Block } from "../../src/diagrams/blockdiagram/model.js";
import { TWO_PANES } from "../support/drawn.js";

const COLUMNS = [2, 3];
const src = (columns: number, body: string): string => `block-beta\n  columns ${columns}\n  ${body.split("\n").join("\n  ")}\n`;
const ids = (blocks: readonly Block[]): string[] => blocks.flatMap((block) => [block.id, ...ids(block.children)]);
const rowOf = (drawing: string, word: string): string => drawing.split("\n").find((line) => line.includes(word)) ?? "";
const cs = UNICODE;

// Measured on mermaid 12.0.0 headless, 2026-09-29: every link below is read by blockDB with its own head and line.
describe("block links mermaid 12 reads that were dropped", () => {
  const cases: ReadonlyArray<readonly [string, EdgeStyle, boolean, boolean, ArrowType]> = [
    ["a --- b", EdgeStyle.SOLID, false, false, ArrowType.ARROW],
    ["a ---> b", EdgeStyle.SOLID, false, true, ArrowType.ARROW],
    ["a ==> b", EdgeStyle.THICK, false, true, ArrowType.ARROW],
    ["a -.-> b", EdgeStyle.DOTTED, false, true, ArrowType.ARROW],
    ["a --x b", EdgeStyle.SOLID, false, true, ArrowType.CROSS],
    ["a --o b", EdgeStyle.SOLID, false, true, ArrowType.CIRCLE],
    ["a <--> b", EdgeStyle.SOLID, true, true, ArrowType.ARROW],
    ["a===b", EdgeStyle.THICK, false, false, ArrowType.ARROW],
  ];

  it.each(COLUMNS.flatMap((n) => cases.map((c) => [n, ...c] as const)))(
    "columns %i: `%s` is one link, its line and heads as mermaid reads them",
    (columns, body, style, start, end, type) => {
      const diagram = parseBlockDiagram(src(columns, body));
      expect(ids(diagram.blocks)).toEqual(["a", "b"]);
      expect(diagram.links).toHaveLength(1);
      const [link] = diagram.links;
      expect([link.source, link.target, link.style, link.hasArrowStart, link.hasArrowEnd, link.typeEnd]).toEqual(["a", "b", style, start, end, type]);
    }
  );

  it.each(COLUMNS)("columns %i: draws each line and head", (columns) => {
    const between = (body: string): string => {
      const row = rowOf(render(src(columns, body)), " a ");
      return row.slice(row.indexOf("a"), row.lastIndexOf("b"));
    };
    expect(between("a --- b")).toContain(cs.lineHorizontal);
    expect(between("a --- b")).not.toContain(cs.arrowRight);
    expect(between("a ==> b")).toContain(cs.lineThickH + cs.arrowRight);
    expect(between("a -.-> b")).toContain(cs.lineDottedH + cs.arrowRight);
    expect(between("a --x b")).toContain(cs.crossEndpoint);
    expect(between("a --o b")).toContain(cs.circleEndpoint);
    expect(between("a <--> b")).toContain(cs.arrowLeft + cs.lineHorizontal);
    expect(between("a <--> b")).toContain(cs.lineHorizontal + cs.arrowRight);
  });

  it.each(COLUMNS)("columns %i: a leading `x` or `o` is a block of its own, linked to the target", (columns) => {
    for (const [body, head, type] of [["a x--x b", "x", ArrowType.CROSS], ["a o--o b", "o", ArrowType.CIRCLE]] as const) {
      const diagram = parseBlockDiagram(src(columns, body));
      expect(ids(diagram.blocks)).toEqual(["a", head, "b"]);
      expect(diagram.links.map((l) => [l.source, l.target, l.hasArrowStart, l.typeEnd])).toEqual([[head, "b", false, type]]);
    }
  });

  it.each(COLUMNS)("columns %i: a label rides every closing link, thick and dotted too", (columns) => {
    const cases: ReadonlyArray<readonly [string, EdgeStyle, boolean, ArrowType]> = [
      ['a -- "t" --- b', EdgeStyle.SOLID, false, ArrowType.ARROW],
      ['a -- "t" --x b', EdgeStyle.SOLID, true, ArrowType.CROSS],
      ['a == "t" ==> b', EdgeStyle.THICK, true, ArrowType.ARROW],
      ['a -. "t" .-> b', EdgeStyle.DOTTED, true, ArrowType.ARROW],
      ['a--"t"-->b', EdgeStyle.SOLID, true, ArrowType.ARROW],
    ];
    for (const [body, style, end, type] of cases) {
      const diagram = parseBlockDiagram(src(columns, body));
      expect(ids(diagram.blocks)).toEqual(["a", "b"]);
      expect(diagram.links.map((l) => [l.label, l.style, l.hasArrowEnd, l.typeEnd])).toEqual([["t", style, end, type]]);
      expect(render(src(columns, body))).toMatch(/ t /u);
    }
  });

  it.each(COLUMNS)("columns %i: a link shares its line with other statements", (columns) => {
    const diagram = parseBlockDiagram(src(columns, "a --> b c"));
    expect(ids(diagram.blocks)).toEqual(["a", "b", "c"]);
    expect(diagram.links).toHaveLength(1);
  });
});

describe("block arrows point where mermaid 12 points them", () => {
  const tips = (body: string, columns: number): string => {
    const drawing = render(src(columns, body));
    return rowOf(drawing, " t ") + "\n" + drawing;
  };

  it.each(COLUMNS)("columns %i: reads the directions, `x` and `y` expanded", (columns) => {
    const arrows = (body: string): string[] => [...(parseBlockDiagram(src(columns, body)).blocks[0]?.arrows ?? [])].sort();
    expect(arrows('r<["t"]>(right)')).toEqual(["right"]);
    expect(arrows('r<["t"]>(x)')).toEqual(["left", "right"]);
    expect(arrows('r<["t"]>(y)')).toEqual(["down", "up"]);
    expect(arrows('r<["t"]>(up, down)')).toEqual(["down", "up"]);
    expect(arrows('r<["t"]>(right, left, up, down)')).toEqual(["down", "left", "right", "up"]);
  });

  it.each(COLUMNS)("columns %i: a tip sits in the middle of each wall it points through", (columns) => {
    const right = rowOf(render(src(columns, 'r<["t"]>(right) b')), " t ");
    expect(right.trimEnd().slice(0, right.indexOf("b"))).toMatch(new RegExp(`t\\s+${cs.arrowRight}`, "u"));
    const both = rowOf(render(src(columns, 'r<["t"]>(x)')), " t ");
    expect(both.trim()).toMatch(new RegExp(`^${cs.arrowLeft}\\s+t\\s+${cs.arrowRight}$`, "u"));
    const vertical = tips('r<["t"]>(y)', columns);
    expect(vertical).toContain(cs.arrowUp);
    expect(vertical).toContain(cs.arrowDown);
  });

  it.each(COLUMNS)("columns %i: spans the columns it is given", (columns) => {
    const diagram = parseBlockDiagram(src(columns, 'r<["t"]>(right):2 b'));
    expect(diagram.blocks.map((b) => [b.id, b.label, b.colSpan])).toEqual([["r", "t", 2], ["b", "b", 1]]);
  });
});

describe("columns settings mermaid 12 reads", () => {
  it.each(COLUMNS)("columns %i: `columns auto` puts every block on one row", (columns) => {
    const diagram = parseBlockDiagram(src(columns, "columns auto\na b c"));
    expect(ids(diagram.blocks)).toEqual(["a", "b", "c"]);
    expect(rowOf(render(src(columns, "columns auto\na b c")), " a ")).toMatch(/ a .* b .* c /u);
  });

  it.each(COLUMNS)("columns %i: blocks after `columns N` on its line are kept", (columns) => {
    const source = `block-beta\n  columns ${columns} a b c d\n`;
    const diagram = parseBlockDiagram(source);
    expect([diagram.columns, ids(diagram.blocks)]).toEqual([columns, ["a", "b", "c", "d"]]);
    expect(rowOf(render(source), " a ")).not.toContain(columns === 2 ? " c " : " d ");
  });

  it.each(COLUMNS)("columns %i: statements on the header line are read", (columns) => {
    for (const header of ["block-beta", "block"]) {
      const diagram = parseBlockDiagram(`${header} columns ${columns} a b\n`);
      expect([diagram.columns, ids(diagram.blocks)]).toEqual([columns, ["a", "b"]]);
    }
  });
});

describe("composites mermaid 12 reads that broke the diagram", () => {
  it.each(COLUMNS)("columns %i: `block:g[\"Title\"]` is a frame titled Title", (columns) => {
    const source = src(columns, 'block:g["Title"]\n  a b\nend\nc');
    const diagram = parseBlockDiagram(source);
    expect(diagram.blocks.map((b) => [b.id, b.label, ids(b.children)])).toEqual([["g", "Title", ["a", "b"]], ["c", "c", []]]);
    const drawing = render(source);
    for (const word of ["Title", " a ", " b ", " c "]) expect(drawing).toContain(word);
  });

  it.each(COLUMNS)("columns %i: `block:g(\"x\")` is a frame titled x, the brackets saying nothing, its width kept", (columns) => {
    const diagram = parseBlockDiagram(src(columns, 'block:g("x"):2\n  a\nend\nc'));
    expect(diagram.blocks.map((b) => [b.id, b.label, b.colSpan, ids(b.children)])).toEqual([["g", "x", 2, ["a"]], ["c", "c", 1, []]]);
  });

  it.each(COLUMNS)("columns %i: a composite opens and closes on one line", (columns) => {
    const named = parseBlockDiagram(src(columns, "block:g:2 a b end\nc"));
    expect(named.blocks.map((b) => [b.id, b.colSpan, ids(b.children)])).toEqual([["g", 2, ["a", "b"]], ["c", 1, []]]);
    const anonymous = parseBlockDiagram(src(columns, "block a b end\nc"));
    expect(anonymous.blocks.map((b) => ids(b.children))).toEqual([["a", "b"], []]);
    expect(render(src(columns, "block a b end\nc"))).not.toContain("end");
  });
});

describe("a block declared twice keeps its first cell", () => {
  it.each(COLUMNS)("columns %i: a second shape updates the type and the label", (columns) => {
    const diagram = parseBlockDiagram(src(columns, 'a["x"]\na("y")\nb'));
    expect(diagram.blocks.map((b) => [b.id, b.label, b.shape])).toEqual([["a", "y", NodeShape.ROUNDED], ["b", "b", NodeShape.RECTANGLE]]);
    const bare = parseBlockDiagram(src(columns, 'a("y")\na\na["z"]'));
    expect(bare.blocks.map((b) => [b.id, b.label, b.shape])).toEqual([["a", "z", NodeShape.RECTANGLE]]);
  });

  it.each(COLUMNS)("columns %i: a block met in a link first is reshaped in place", (columns) => {
    const diagram = parseBlockDiagram(src(columns, 'a --> b\nb("x")'));
    expect(diagram.blocks.map((b) => [b.id, b.label, b.shape])).toEqual([["a", "a", NodeShape.RECTANGLE], ["b", "x", NodeShape.ROUNDED]]);
    expect(render(src(columns, 'a --> b\nb("x")')).match(/ x /gu)).toHaveLength(1);
  });
});

describe("a composite named before it opens", () => {
  it.each(COLUMNS)("columns %i: keeps the first cell, relabelled, its late children lost as in mermaid", (columns) => {
    const diagram = parseBlockDiagram(src(columns, 'g --> b\nblock:g["T"]\n  a\nend\nc'));
    expect(diagram.blocks.map((b) => [b.id, b.label, ids(b.children)])).toEqual([["g", "T", []], ["b", "b", []], ["c", "c", []]]);
    expect(diagram.links.map((l) => [l.source, l.target])).toEqual([["g", "b"]]);
  });
});

describe("an elbowed block link bends on a corner", () => {
  const diagonal = (columns: number, op: string): string =>
    columns === 2 ? src(2, `a b\nc d\nb ${op} c`) : src(3, `a b c\nd e f\nc ${op} d\na ${op} f`);

  it.each(COLUMNS)("columns %i: never a crossing where the line turns, whatever its line", (columns) => {
    for (const op of ["-->", "-.->", "==>"]) {
      const drawing = render(diagonal(columns, op));
      expect(drawing).not.toContain("┼");
      expect(drawing).toMatch(/[┘┌┐└┛┏┓┗]/u);
    }
  });
});

// Measured on mermaid 12.0.0 headless, 2026-09-29: a block of width 0 sends every block to Infinity, while
// `space:0` fills no column; here such a block takes one column, see docs/divergences.md.
describe.each(TWO_PANES)("a block of width 0 at width %i", (width) => {
  const cases: ReadonlyArray<readonly [string, RegExp]> = [
    ["block-beta\n  a:0 b\n", /│\s+a\s+│\s+│\s+b\s+│/u],
    ["block-beta\n  columns 3\n  a b:0 c\n", /│\s+a\s+│\s+│\s+b\s+│\s+│\s+c\s+│/u],
    ["block-beta\n  columns 3\n  a space:0 c\n", /│\s+a\s+│\s+│\s+c\s+│/u],
  ];

  it.each(cases)("`%s` lays each block on its own column, a `space:0` on none", (source, row) => {
    expect(rowOf(render(source, { width }), " a ")).toMatch(row);
  });
});
