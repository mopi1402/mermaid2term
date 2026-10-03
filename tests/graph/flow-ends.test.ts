import { describe, it, expect } from "vitest";
import { parse } from "../../src/index.js";
import { rootsAmong, sinksAmong } from "../../src/graph/model.js";

describe("the ends of a flow, read the same way wherever they are asked for", () => {
  it("counts a node that only points at ITSELF as a start, a self-edge reaching nothing", () => {
    const graph = parse("flowchart TD\n  A --> A\n  C --> D\n");
    expect(graph.getRoots()).toEqual(["A", "C"]);
  });

  it("keeps a node a real edge reaches out of the starts, self-edge or not", () => {
    const graph = parse("flowchart TD\n  A --> B\n  B --> B\n");
    expect(graph.getRoots()).toEqual(["A"]);
  });

  it("reads the ends of a SUBSET off the edges it is given, which is how a box's members are read", () => {
    const graph = parse("flowchart TD\n  subgraph box\n    X --> Y\n  end\n  Y --> Z\n");
    const members = ["X", "Y"];
    const inside = graph.edges.filter((e) => members.includes(e.source) && members.includes(e.target));
    expect(rootsAmong(members, inside)).toEqual(["X"]);
    expect(sinksAmong(members, inside)).toEqual(["Y"]);
    expect(sinksAmong(members, graph.edges)).toEqual([]);
  });

  it("falls back to nothing of its own, the caller choosing what an all-cycle set answers", () => {
    const graph = parse("flowchart TD\n  A --> B\n  B --> A\n");
    expect(rootsAmong(graph.nodeOrder, graph.edges)).toEqual([]);
    expect(graph.getRoots()).toEqual(["A"]);
  });
});
