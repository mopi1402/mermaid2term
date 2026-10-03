import { describe, it, expect } from "vitest";
import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { computeLayout } from "../../src/graph/layout/passes.js";
import { edgeSides, placedEdges } from "../../src/graph/layout/edges.js";
import { sideSeatDemands } from "../../src/graph/layout/seats.js";
import { drumSeats } from "../../src/graph/layout/padless.js";
import { DrumRim } from "../../src/graph/layout/laid.js";
import { AttachDir, SELF_LOOP_SIDES } from "../../src/graph/sides.js";
import { must } from "../../src/must.js";

const lay = (source: string, options: Record<string, unknown> = {}) => {
  const graph = parseFlowchart(source);
  return { graph, layout: computeLayout(graph, { paddingX: 4, paddingY: 2, gap: 4, ...options }) };
};

describe("the edges a pass reads come from ONE iterator: both ends placed, and an invisible link left out unless asked for", () => {
  it("skips `~~~` by default, keeps it on request, and never yields an edge with an unplaced end", () => {
    const { graph, layout } = lay("flowchart TB\n    subgraph S\n        A\n    end\n    A --> B\n    A ~~~ C\n    S --> B");
    expect([...placedEdges(graph, layout)].map((p) => `${p.edge.source}->${p.edge.target}`)).toEqual(["A->B"]);
    expect([...placedEdges(graph, layout, { invisible: true })].map((p) => `${p.edge.source}->${p.edge.target}`)).toEqual(["A->B", "A->C"]);
  });
});

describe("an edge's sides are decided ONCE: the router's first pair, a loop's two, and a cluster end read along the flow", () => {
  it("a forward edge down the page leaves by the bottom and arrives at the top", () => {
    const { graph, layout } = lay("flowchart TB\n    A --> B");
    const [ab] = [...edgeSides(graph, layout)];
    expect(ab).toMatchObject({ from: AttachDir.BOTTOM, to: AttachDir.TOP });
  });
  it("a loop on one node takes the two sides the router always gives it, out of the top and back into the right", () => {
    const { graph, layout } = lay("flowchart TB\n    A --> A");
    const [aa] = [...edgeSides(graph, layout)];
    expect([aa?.from, aa?.to]).toEqual(SELF_LOOP_SIDES);
  });
  it("a cluster source arrives on the target's upstream border, a cluster target is left by the source's downstream one, and `~~~` is not offered", () => {
    const tb = lay("flowchart TB\n    subgraph S\n        A\n    end\n    S --> B\n    B --> S\n    A ~~~ B");
    const sides = [...edgeSides(tb.graph, tb.layout)].map((s) => [s.edge.source, s.edge.target, s.from, s.to]);
    expect(sides).toEqual([
      ["S", "B", undefined, AttachDir.TOP],
      ["B", "S", AttachDir.BOTTOM, undefined],
    ]);
    const lr = lay("flowchart LR\n    subgraph S\n        A\n    end\n    S --> B");
    expect([...edgeSides(lr.graph, lr.layout)][0]).toMatchObject({ from: undefined, to: AttachDir.LEFT });
  });
});

describe("what the three rules did not agree on, settled: `~~~` buys no room, a loop seats two, a cluster's run counts for the drum it reaches", () => {
  it("a fan of invisible links does not widen the node they leave, where a fan of drawn edges does", () => {
    const width = (arrow: string): number => {
      const { layout } = lay(`flowchart TB\n    A --> B\n    A ${arrow} C\n    A ${arrow} D\n    A ${arrow} E\n    A ${arrow} F`, { paddingX: 0, paddingY: 0, gap: 1 });
      return must(layout.placements.get("A")?.drawWidth);
    };
    const alone = must(lay("flowchart TB\n    A --> B", { paddingX: 0, paddingY: 0, gap: 1 }).layout.placements.get("A")?.drawWidth);
    expect(width("~~~")).toBe(alone);
    expect(width("-->")).toBeGreaterThan(alone);
  });
  it("a loop asks one seat of the top rule and one of the right wall, as the two sides it takes", () => {
    const { graph, layout } = lay("flowchart TB\n    A --> A");
    expect(sideSeatDemands(graph, layout, false).get("A")).toEqual({ rows: 1, cols: 1 });
  });
  it("a run out of a cluster into a drum seats the drum's rim exactly as the same run out of a node would", () => {
    const cluster = lay("flowchart TB\n    subgraph S\n        A\n    end\n    S --> F[(db)]", { padless: true });
    const node = lay("flowchart TB\n    A --> F[(db)]", { padless: true });
    const fromNode = drumSeats(node.graph, node.layout).get("F");
    expect(fromNode?.rim).toBe(DrumRim.BELOW);
    expect(drumSeats(cluster.graph, cluster.layout).get("F")).toEqual(fromNode);
  });
});
