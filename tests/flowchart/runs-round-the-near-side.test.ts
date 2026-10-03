// A run that must round a frame takes whichever side crosses least. Browser to PostgreSQL went round the right of
// Server, the only side the grid opened, and crossed five runs on its way back left; left of Server, or over it across
// the page, it crosses none. The one crossing left is the X that App Server 1 to Redis and App Server 2 to PostgreSQL
// make whatever the drawing does.

import { describe, expect, it } from "vitest";

import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { drawGraph } from "../../src/graph/render/draw.js";
import { DEFAULT_RENDER, type BorderMode } from "../../src/options.js";
import { LINK_STYLE_PREFIX, isChip } from "../../src/canvas/keys.js";

const TIERS = (direction: string): string => `flowchart ${direction}
    subgraph Client
        A[Browser]
    end
    subgraph Server
        B[Load Balancer]
        C[App Server 1]
        D[App Server 2]
    end
    subgraph Data
        E[(PostgreSQL)]
        F[(Redis)]
    end
    Client --> Server
    A --> B
    A --> C
    A --> E
    Server --> F
    D <--> Data
    B --> C
    B --> D
    C --> E
    D --> E
    C --> F
    D --> F
    linkStyle default stroke:#888
`;

// Each cell of one link's run with another link's run on both sides of it, across or down: one crosses the other.
function crossings(source: string, borders: BorderMode): string[] {
  const graph = parseFlowchart(source);
  const drawn = drawGraph(graph, { ...DEFAULT_RENDER, borders });
  if (drawn === undefined) return ["nothing drawn"];
  const { canvas } = drawn;
  const linkOf = (r: number, c: number): number | undefined => {
    const key = canvas.getStyle(r, c);
    if (!key.startsWith(LINK_STYLE_PREFIX) || isChip(key) || canvas.get(r, c) === " ") return undefined;
    return Number.parseInt(key.slice(LINK_STYLE_PREFIX.length), 10);
  };
  const name = (i: number): string => `${graph.edges[i].source}->${graph.edges[i].target}`;
  const found: string[] = [];
  for (let r = 0; r < canvas.height; r++) {
    for (let c = 0; c < canvas.width; c++) {
      const mine = linkOf(r, c);
      if (mine === undefined) continue;
      for (const [a, b] of [[linkOf(r, c - 1), linkOf(r, c + 1)], [linkOf(r - 1, c), linkOf(r + 1, c)]]) {
        if (a !== undefined && a === b && a !== mine) found.push([name(mine), name(a)].sort().join(" x "));
      }
    }
  }
  return found;
}

// The cells beside Browser to PostgreSQL's run, across its way, that hold a wall's stroke: a run laid against a wall
// reads as one line with it, `││`.
function glued(source: string): string[] {
  const graph = parseFlowchart(source);
  const drawn = drawGraph(graph, DEFAULT_RENDER);
  if (drawn === undefined) return ["nothing drawn"];
  const { canvas } = drawn;
  const rounding = `${LINK_STYLE_PREFIX}${graph.edges.findIndex((e) => e.source === "A" && e.target === "E")}`;
  const linked = (r: number, c: number): boolean => canvas.getStyle(r, c).startsWith(LINK_STYLE_PREFIX);
  const found: string[] = [];
  for (let r = 0; r < canvas.height; r++) {
    for (let c = 0; c < canvas.width; c++) {
      if (canvas.getStyle(r, c) !== rounding) continue;
      const glyph = canvas.get(r, c);
      const beside = glyph === "│" ? [[r, c - 1], [r, c + 1]] : glyph === "─" ? [[r - 1, c], [r + 1, c]] : [];
      for (const [rr, cc] of beside) if (!linked(rr, cc) && canvas.get(rr, cc) === glyph) found.push(`${glyph} at ${r},${c}`);
    }
  }
  return found;
}

describe("a run rounding the drawing stands a cell off the wall it passes", () => {
  it.each(["TD", "LR"])("%s", (direction) => {
    expect(glued(TIERS(direction))).toEqual([]);
  });
});

describe("a run rounds a frame on the side that crosses least", () => {
  for (const direction of ["TD", "LR"]) {
    for (const borders of ["default", "padless"] as const) {
      it(`${direction}, ${borders}: only the X between the two app servers and the two stores`, () => {
        expect(crossings(TIERS(direction), borders)).toEqual(["C->F x D->E"]);
      });
    }
  }
});

// Server to Redis leaves Server's floor alone on its lane, and stood against App Server 2 to PostgreSQL, `│┬`, where a
// lane clear of both was open beside it.
function against(source: string): string[] {
  const graph = parseFlowchart(source);
  const drawn = drawGraph(graph, DEFAULT_RENDER);
  if (drawn === undefined) return ["nothing drawn"];
  const { canvas } = drawn;
  const own = `${LINK_STYLE_PREFIX}${graph.edges.findIndex((e) => e.source === "Server" && e.target === "F")}`;
  const other = (r: number, c: number): boolean => {
    const key = canvas.getStyle(r, c);
    return key.startsWith(LINK_STYLE_PREFIX) && key !== own && !isChip(key);
  };
  const found: string[] = [];
  for (let r = 0; r < canvas.height; r++) {
    for (let c = 0; c < canvas.width; c++) {
      if (canvas.getStyle(r, c) !== own) continue;
      const glyph = canvas.get(r, c);
      const beside = glyph === "│" ? [[r, c - 1], [r, c + 1]] : glyph === "─" ? [[r - 1, c], [r + 1, c]] : [];
      for (const [rr, cc] of beside) if (other(rr, cc) && canvas.get(rr, cc) === glyph) found.push(`${glyph} at ${r},${c}`);
    }
  }
  return found;
}

describe("a frame's run stands a cell off a run beside it, where a lane is open", () => {
  it.each(["TD", "LR"])("%s", (direction) => {
    expect(against(TIERS(direction))).toEqual([]);
  });
});
