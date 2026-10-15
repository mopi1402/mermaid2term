import { describe, it, expect } from "vitest";
import { parseArchitecture, renderThemedText } from "../../src/index.js";
import { everySubgraph } from "../../src/graph/subgraph-tree.js";

const NESTED_JUNCTION = [
  "architecture-beta",
  "    group outer[Outer]",
  "    group inner[Inner] in outer",
  "    service a[Left] in inner",
  "    service b[Right] in inner",
  "    junction j in inner",
  "    a:R -- L:j",
  "    j:R -- L:b",
].join("\n");

describe("a junction declared in a nested group leaves that group when it is eliminated (2026-09-17)", () => {
  it("is listed by no subgraph at any depth once its node is gone", () => {
    const graph = parseArchitecture(NESTED_JUNCTION);
    expect(graph.nodes.has("j")).toBe(false);
    expect(graph.edges.map((e) => [e.source, e.target])).toEqual([["a", "b"]]);
    for (const sg of everySubgraph(graph)) expect(sg.nodeIds, `group ${sg.id}`).not.toContain("j");
  });

  it("renders `Left` joined to `Right` with no stray cell between them, under `padless` and `default` alike", () => {
    for (const borders of ["padless", "default"] as const) {
      const drawn = renderThemedText(NESTED_JUNCTION, { width: 80, borders }, "default").plain.split("\n");
      const row = drawn.find((r) => r.includes("Left"));
      expect(row, `${borders}: the row holding Left`).toBeDefined();
      expect(row).toMatch(/Left\s*[├┝▕│][─━]+⏵?[▏│┤┥]\s*Right/u);
    }
  });
});
