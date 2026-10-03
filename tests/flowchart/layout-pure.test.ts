import { describe, expect, it } from "vitest";
import { parse, renderGraph } from "../../src/index.js";
import { must } from "../../src/must.js";

const LONG = "A label so long that it runs well past the twenty column wrap";

const source = (direction: string): string => `flowchart ${direction}\n  A[${LONG}] --> B[Short]\n  A --> C[Also short]\n`;

describe.each(["TD", "LR"])("layout leaves the parsed graph untouched (%s)", (direction) => {
  it("renders the same text twice from one parse, label intact", () => {
    const graph = parse(source(direction));
    const first = renderGraph(graph);
    expect(must(graph.nodes.get("A")).label).toBe(LONG);
    expect(renderGraph(graph)).toBe(first);
  });

  it("folds for a budget without writing the fold into the graph", () => {
    const graph = parse(source(direction));
    const first = renderGraph(graph, { wrapLabels: true }, 30);
    expect(must(graph.nodes.get("A")).label).toBe(LONG);
    expect(renderGraph(graph, { wrapLabels: true }, 30)).toBe(first);
  });
});
