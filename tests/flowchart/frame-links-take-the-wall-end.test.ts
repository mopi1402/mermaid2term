// A link to a frame meets the frame's wall past every run its members send through it. Client to Server left the
// Client's floor between Browser's runs to App Server 1 and to the Load Balancer, and Server to Redis left the
// Server's floor between App Server 2's two runs down: each now stands at the end of the wall, on the side it heads to.

import { describe, expect, it } from "vitest";

import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { drawGraph } from "../../src/graph/render/draw.js";
import { DEFAULT_RENDER, type BorderMode } from "../../src/options.js";

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
    Server --> F
    D <--> Data
    Server <--> Data
    A --> C
    A --> E
    B --> C
    B --> D
    C --> E
    D --> E
    C --> F
    D --> F
`;

// The seats the link and every run of the frame's members take on the wall the link meets the frame on.
function seatsOn(direction: string, borders: BorderMode, source: string, target: string, frame: string): { own: number; members: number[] } {
  const drawn = drawGraph(parseFlowchart(TIERS(direction)), { ...DEFAULT_RENDER, borders });
  if (drawn === undefined) throw new Error("nothing drawn");
  const { routed, layout } = drawn;
  const link = routed.find((re) => re.edge.source === source && re.edge.target === target);
  const sb = layout.subgraphBounds.find((b) => b.subgraph.id === frame);
  if (link === undefined || sb === undefined) throw new Error(`no ${source} --> ${target} or no ${frame}`);
  const path = link.drawPath;
  const atEnd = target === frame;
  const end = atEnd ? path[path.length - 1] : path[0];
  const next = atEnd ? path[path.length - 2] : path[1];
  const alongRow = end[1] === next[1];
  const [line, own, low, high] = alongRow ? [end[0], end[1], sb.y, sb.y + sb.height - 1] : [end[1], end[0], sb.x, sb.x + sb.width - 1];
  const members: number[] = [];
  for (const re of routed) {
    if (re === link || re.edge.source === frame || re.edge.target === frame) continue;
    for (let k = 0; k + 1 < re.drawPath.length; k++) {
      const [a, b] = [re.drawPath[k], re.drawPath[k + 1]];
      if (alongRow ? a[1] !== b[1] || a[0] === b[0] : a[0] !== b[0] || a[1] === b[1]) continue;
      const [from, to, at] = alongRow ? [a[0], b[0], a[1]] : [a[1], b[1], a[0]];
      if (Math.min(from, to) <= line && Math.max(from, to) >= line && at > low && at < high) members.push(at);
    }
  }
  return { own, members };
}

const outermost = ({ own, members }: { own: number; members: number[] }): boolean =>
  members.every((at) => at < own) || members.every((at) => at > own);

describe("a link to a frame meets its wall past every run of the frame's members (2026-10-19)", () => {
  for (const direction of ["TD", "LR"]) {
    for (const borders of ["default", "padless"] as const) {
      it(`${direction} ${borders}: Client --> Server stands past Browser's runs on the Client's wall and on the Server's`, () => {
        expect(outermost(seatsOn(direction, borders, "Client", "Server", "Client"))).toBe(true);
        expect(outermost(seatsOn(direction, borders, "Client", "Server", "Server"))).toBe(true);
      });

      it(`${direction} ${borders}: Server --> F stands past App Server 2's runs on the Server's wall`, () => {
        expect(outermost(seatsOn(direction, borders, "Server", "F", "Server"))).toBe(true);
      });
    }
  }
});
