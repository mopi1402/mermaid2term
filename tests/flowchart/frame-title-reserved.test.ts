import { describe, expect, it } from "vitest";

import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { type GridLayout } from "../../src/graph/layout/grid.js";
import { computeLayout } from "../../src/graph/layout/passes.js";
import { boxesUnder, membersOf } from "../../src/graph/subgraph-tree.js";
import { render } from "../../src/index.js";

const TITLE = "A rather long subgraph title here";

const NEIGHBOUR = (dir: string): string => `flowchart ${dir}
  subgraph S [${TITLE}]
    A
  end
  A --> Z --> W`;

const SIDE_BY_SIDE = (dir: string): string => `flowchart ${dir}
  subgraph S [${TITLE}]
    A
  end
  subgraph T [Another long frame title too]
    B
  end
  A --> B`;

const ACROSS = (dir: string): string => `flowchart ${dir}
  X --> A
  X --> B
  subgraph S [${TITLE}]
    A
  end`;

const STACKED = (dir: string): string => `flowchart ${dir}
  subgraph S [${TITLE}]
    A
  end
  subgraph T [Another long frame title]
    B
  end
  A --> Z
  B --> Z
  subgraph O [Outer frame with a long title here]
    subgraph I [Inner title that is long]
      C
    end
  end
  C --> Y`;

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const meets = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Every box outside a frame and every frame neither holding nor held by it, met by the frame's rectangle.
function overlaps(layout: GridLayout): string[] {
  const found: string[] = [];
  for (const sb of layout.subgraphBounds) {
    const frame = { x: sb.x, y: sb.y, w: sb.width, h: sb.height };
    const held = membersOf(sb.subgraph);
    for (const [id, p] of layout.placements) {
      if (!held.has(id) && meets(frame, { x: p.drawX, y: p.drawY, w: p.drawWidth, h: p.drawHeight })) found.push(`${sb.subgraph.id} over ${id}`);
    }
    for (const other of layout.subgraphBounds) {
      const nested = boxesUnder(sb.subgraph).includes(other.subgraph) || boxesUnder(other.subgraph).includes(sb.subgraph);
      if (!nested && meets(frame, { x: other.x, y: other.y, w: other.width, h: other.height })) found.push(`${sb.subgraph.id} over ${other.subgraph.id}`);
    }
  }
  return found;
}

const laid = (source: string, titles?: ReadonlyMap<string, string>): GridLayout =>
  computeLayout(parseFlowchart(source), { paddingX: 4, paddingY: 2, gap: 4, titles });

describe("a frame widened by its title keeps its neighbours clear", () => {
  for (const dir of ["TD", "LR", "RL", "BT"]) {
    for (const source of [NEIGHBOUR, SIDE_BY_SIDE, ACROSS, STACKED]) {
      it(`lays no frame over a box or a frame beside it (${dir}, ${source.name})`, () => {
        expect(overlaps(laid(source(dir)))).toEqual([]);
        expect(overlaps(laid(source(dir), new Map([["S", "A rather long\\nsubgraph title here"]])))).toEqual([]);
      });
    }
  }

  it.each(["TD", "LR"])("draws the frame's box and the next one apart at width 40 (%s)", (dir) => {
    const rows = render(NEIGHBOUR(dir), { width: 40 }).split("\n");
    for (const row of rows) expect(row).not.toMatch(/┤|├─*┐|┌─*┤/u);
  });
});
