import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { computeLayout } from "../../src/graph/layout/passes.js";
import { must } from "../../src/must.js";

// A parent laid across the flow holding two frames of unequal length, the shorter one fed by the longer.
const SOURCES = {
  LR: "flowchart LR\n  subgraph TOP\n    direction TB\n    subgraph B1\n        direction RL\n        i1 -->f1\n    end\n    subgraph B2\n        direction BT\n        i2 -->f2\n    end\n  end\n  A --> TOP --> B\n  B1 --> B2\n",
  TD: "flowchart TB\n  subgraph TOP\n    direction LR\n    subgraph B1\n        direction BT\n        i1 -->f1\n    end\n    subgraph B2\n        direction RL\n        i2 -->f2\n    end\n  end\n  A --> TOP --> B\n  B1 --> B2\n",
} as const;

const HEAD = { LR: "⏷", TD: "⏵" } as const;
const TEE = { LR: "┬", TD: "├" } as const;

describe("a frame inside a parent that crosses the flow is centred on its sibling, as mermaid centres it", () => {
  it.each(["LR", "TD"] as const)("stands on the middle of the longer frame, direction %s", (direction) => {
    const layout = computeLayout(parseFlowchart(SOURCES[direction]));
    const frame = (id: string) => must(layout.subgraphBounds.find((sb) => sb.subgraph.id === id));
    const middle = (id: string): number => {
      const sb = frame(id);
      return direction === "LR" ? 2 * sb.x + sb.width : 2 * sb.y + sb.height;
    };
    expect(Math.abs(middle("B2") - middle("B1"))).toBeLessThanOrEqual(2);
  });

  it.each(["LR", "TD"] as const)("runs the link between them straight, off the middle of the longer one, direction %s", (direction) => {
    for (const borders of ["default", "borderless"] as const) {
      const rows = render(SOURCES[direction], { width: 120, borders }).split("\n").map((row) => [...row]);
      const at = must(rows.flatMap((row, r) => row.flatMap((ch, c) => (ch === HEAD[direction] ? [[r, c]] : [])))[0]);
      const [r, c] = at;
      const fed = direction === "LR" ? rows.slice(0, r).some((row) => row[c] === TEE.LR) : rows[r].slice(0, c).includes(TEE.TD);
      expect(fed).toBe(true);
    }
  });
});
