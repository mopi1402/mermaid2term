// A run takes no step it can drop. App Server 1 to Redis stepped right, down, right and down again where one corner
// does, and App Server 2 to Data rose a row to cross App Server 1's run, then fell back, where crossing it on its own
// row does: each step was a corner the grid search left, crossing nothing less than the one corner would.

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
    B --> C
    B --> D
    C --> E
    D --> E
    C --> F
    D --> F
`;

function corners(direction: string, borders: BorderMode, source: string, target: string): number {
  const drawn = drawGraph(parseFlowchart(TIERS(direction)), { ...DEFAULT_RENDER, borders });
  const link = drawn?.routed.find((re) => re.edge.source === source && re.edge.target === target);
  if (link === undefined) throw new Error(`no ${source} --> ${target}`);
  const path = link.drawPath;
  let turns = 0;
  for (let k = 1; k + 1 < path.length; k++) {
    const [a, b, c] = [path[k - 1], path[k], path[k + 1]];
    if (!((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]))) turns++;
  }
  return turns;
}

describe("a run takes no step it can drop (2026-10-19)", () => {
  for (const borders of ["default", "padless"] as const) {
    it(`LR ${borders}: App Server 1 to Redis turns twice, App Server 2 to Data runs straight`, () => {
      expect(corners("LR", borders, "C", "F")).toBe(2);
      expect(corners("LR", borders, "D", "Data")).toBe(0);
    });

    it(`TD ${borders}: App Server 1 to Redis and App Server 2 to Data each turn twice`, () => {
      expect(corners("TD", borders, "C", "F")).toBe(2);
      expect(corners("TD", borders, "D", "Data")).toBe(2);
    });
  }
});
