import { describe, it, expect } from "vitest";
import { render, renderThemed, parseFlowchart, parseStateDiagram } from "../../src/index.js";
import { nodeProps } from "../../src/graph/render/nodes.js";
import { must } from "../../src/must.js";

const RED_BACKGROUND = "48;2;255;0;0";

const inkOf = (painted: string, letter: string): string => {
  const run = new RegExp(`\\u001b\\[([0-9;:]*)m${letter}\\u001b`, "u").exec(painted) ?? undefined;
  return must(run)[1];
};

describe("a node wearing two classes, every one applied and the later winning a property, as mermaid's setClass stacks them", () => {
  const flowchart = (direction: string): string => `flowchart ${direction}
    classDef a fill:#f00
    classDef b stroke-dasharray: 5
    A:::a --> B
    class A b
    class B a
    class B b
`;

  it("keeps both names on the node, in the order they were worn", () => {
    const graph = parseFlowchart(flowchart("TD"));
    expect(graph.nodes.get("A")?.styleClasses).toEqual(["a", "b"]);
    expect(graph.nodes.get("B")?.styleClasses).toEqual(["a", "b"]);
    const props = nodeProps(graph, "A", must(graph.nodes.get("A")).styleClasses);
    expect(props?.get("fill")).toBe("#f00");
    expect(props?.get("stroke-dasharray")).toBe("5");
  });

  it.each(["TD", "LR"])("draws the dashed frame of one class and the fill of the other, %s", (direction) => {
    const source = flowchart(direction);
    const drawn = render(source, { width: 60 });
    expect(drawn).toMatch(/╵\s+A\s/u);
    expect(drawn).toMatch(/\sB\s+╵/u);
    const painted = renderThemed(source, { width: 60 }, "classic");
    expect(painted).toContain("╵");
    expect(inkOf(painted, "A")).toContain(RED_BACKGROUND);
    expect(inkOf(painted, "B")).toContain(RED_BACKGROUND);
  });

  it("lets the class worn last win a property both define, like CSS", () => {
    const later = parseFlowchart("flowchart LR\n    classDef a fill:#f00\n    classDef b fill:#00f\n    A:::a --> B\n    class A b\n    class B b\n    class B a\n");
    const a = nodeProps(later, "A", must(later.nodes.get("A")).styleClasses);
    const b = nodeProps(later, "B", must(later.nodes.get("B")).styleClasses);
    expect(a?.get("fill")).toBe("#00f");
    expect(b?.get("fill")).toBe("#f00");
  });

  // A rounded state draws no dashed wall in the plain render, so the border is read off the props here.
  it("dresses a state the same way, through `:::` and `class`", () => {
    const source = `stateDiagram-v2
    classDef a fill:#f00
    classDef b stroke-dasharray: 5
    [*] --> S:::a
    class S b
    T:::a
    class T b
`;
    const graph = parseStateDiagram(source);
    expect(graph.nodes.get("S")?.styleClasses).toEqual(["a", "b"]);
    expect(graph.nodes.get("T")?.styleClasses).toEqual(["a", "b"]);
    for (const id of ["S", "T"]) {
      const props = nodeProps(graph, id, must(graph.nodes.get(id)).styleClasses);
      expect(props?.get("fill")).toBe("#f00");
      expect(props?.get("stroke-dasharray")).toBe("5");
    }
    const painted = renderThemed(source, { width: 60 }, "classic");
    expect(inkOf(painted, "S")).toContain(RED_BACKGROUND);
    expect(inkOf(painted, "T")).toContain(RED_BACKGROUND);
  });
});
