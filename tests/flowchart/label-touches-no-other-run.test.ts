// A label must name one run at a glance. Four links into one hub set `access` on its own run's shaft but over App's
// red run as well, on the row `errors` already took above it: either could have been App's. Every label of the hub
// now touches its own run and no other.

import { describe, expect, it } from "vitest";

import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { drawGraph } from "../../src/graph/render/draw.js";
import { DEFAULT_RENDER, type BorderMode } from "../../src/options.js";
import { LINK_STYLE_PREFIX, isChip } from "../../src/canvas/keys.js";

const HUB = (direction: string): string => `flowchart ${direction}
    A[App] -->|errors| H[Log Hub]
    B[Nginx] -->|access| H
    C[Worker] -.->|jobs| H
    D[Postgres] ==>|slow queries| H
    H ==>|critical| E[On-call]
    H -->|the rest| F[Storage]
    linkStyle default stroke:#888
`;

// Under a default link style every run and every label carries its link's index in its key: each run a label cell
// stands against, over, under or at an end, that belongs to another link.
function strayTouches(source: string, borders: BorderMode): string[] {
  const graph = parseFlowchart(source);
  const drawn = drawGraph(graph, { ...DEFAULT_RENDER, borders });
  if (drawn === undefined) return ["nothing drawn"];
  const { canvas } = drawn;
  const linkOf = (r: number, c: number): number | undefined => {
    const key = canvas.getStyle(r, c);
    return key.startsWith(LINK_STYLE_PREFIX) ? Number.parseInt(key.slice(LINK_STYLE_PREFIX.length), 10) : undefined;
  };
  const stray = new Set<string>();
  for (let r = 0; r < canvas.height; r++) {
    for (let c = 0; c < canvas.width; c++) {
      const mine = linkOf(r, c);
      if (mine === undefined || !isChip(canvas.getStyle(r, c))) continue;
      for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        const other = linkOf(rr, cc);
        if (other !== undefined && other !== mine && !isChip(canvas.getStyle(rr, cc)) && canvas.get(rr, cc) !== " ") {
          stray.add(`${graph.edges[mine].label} against ${graph.edges[other].source}->${graph.edges[other].target}`);
        }
      }
    }
  }
  return [...stray];
}

describe("every label of a hub touches its own run and no other", () => {
  for (const direction of ["TD", "LR"]) {
    for (const borders of ["default", "padless"] as const) {
      it(`${direction}, ${borders}`, () => {
        expect(strayTouches(HUB(direction), borders)).toEqual([]);
      });
    }
  }
});
