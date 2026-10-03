import { describe, it, expect } from "vitest";
import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { frameRoom } from "../../src/graph/layout/grid.js";
import { computeLayout } from "../../src/graph/layout/passes.js";
import { must } from "../../src/must.js";

const SOURCE = [
  "flowchart TB",
  "    subgraph Outer",
  "        subgraph Inner",
  "            A[one]",
  "        end",
  "        B[two]",
  "    end",
  "    subgraph Other",
  "        C[three]",
  "    end",
  "    A --> C",
  "    Outer --> Other",
].join("\n");

describe("a frame is found ONCE: `frameOf` is the scan of `subgraphBounds` by id, cached, and `tight` is the padless predicate", () => {
  for (const padless of [true, false]) {
    it(`padless=${padless}: frameOf(id) is exactly what the linear scan found, and nothing for an unknown id`, () => {
      const layout = computeLayout(parseFlowchart(SOURCE), { paddingX: 4, paddingY: 2, gap: 4, padless, snugFrames: true });
      expect(layout.subgraphBounds.length).toBe(3);
      for (const sb of layout.subgraphBounds) {
        expect(layout.frameOf(sb.subgraph.id)).toBe(layout.subgraphBounds.find((b) => b.subgraph.id === sb.subgraph.id));
      }
      expect(layout.frameOf("nobody")).toBeUndefined();
      expect(layout.frames().size).toBe(3);
      expect([...layout.frames().values()]).toEqual(layout.subgraphBounds);
    });

    it(`padless=${padless}: tight is padless and not concurrent, a composite closing on its cells like any container`, () => {
      const layout = computeLayout(parseFlowchart(SOURCE), { paddingX: 4, paddingY: 2, gap: 4, padless, snugFrames: true });
      for (const sb of layout.subgraphBounds) {
        expect(frameRoom(sb.subgraph, layout).tight).toBe(layout.padless && !sb.subgraph.concurrent);
      }
      const base = must(layout.subgraphBounds[0]).subgraph;
      const composite = { ...base, composite: true, concurrent: false };
      const region = { ...base, composite: false, concurrent: true };
      // A concurrent region is the one frame the padless alphabet leaves alone: its border is DASHED, and no eighth
      // of a cell is dotted, so it keeps the box it is drawn with.
      expect(frameRoom(composite, layout).tight).toBe(padless);
      expect(frameRoom(region, layout).tight).toBe(false);
    });
  }

  it("the cache follows the array: bounds replaced after the first lookup are found on the next", () => {
    const layout = computeLayout(parseFlowchart(SOURCE), { paddingX: 4, paddingY: 2, gap: 4, padless: true, snugFrames: true });
    const first = layout.frameOf("Other");
    expect(first).toBeDefined();
    layout.subgraphBounds = layout.subgraphBounds.filter((sb) => sb.subgraph.id !== "Other");
    expect(layout.frameOf("Other")).toBeUndefined();
    expect(layout.frames().size).toBe(2);
  });
});
