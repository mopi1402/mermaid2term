import { describe, expect, it } from "vitest";

import { declaredType, parseFlowchart, render, renderThemed } from "../../src/index.js";
import { Direction, EdgeStyle } from "../../src/graph/model.js";
import { NodeShape } from "../../src/graph/shapes.js";
import { uncommented } from "../../src/source/lines.js";
import { themeAsked } from "../../src/paint/frontmatter.js";
import { applyShowIds } from "../../src/cli/source.js";
import { withConfig } from "../support/frontmatter.js";

const ids = (source: string): string[] => [...parseFlowchart(source).nodes.keys()];

describe("flowchart statements mermaid accepts that used to be read as nodes or dropped", () => {
  it("skips accTitle and accDescr, one line or braced over several", () => {
    expect(ids("flowchart LR\n accTitle: My title\n accDescr: A description\n A-->B")).toEqual(["A", "B"]);
    expect(ids("flowchart LR\n accDescr {\n multi\n line\n }\n A-->B")).toEqual(["A", "B"]);
    expect(ids("flowchart LR\n accDescr { one line }\n A-->B")).toEqual(["A", "B"]);
  });

  it("defines every class of a comma list in one classDef", () => {
    const graph = parseFlowchart("flowchart LR\n A-->B\n classDef a,b fill:#f9f\n classDef a stroke:#000");
    expect([...graph.classDefs.keys()]).toEqual(["a", "b"]);
    expect(graph.classDefs.get("a")?.get("stroke")).toBe("#000");
    expect(graph.classDefs.get("b")?.get("fill")).toBe("#f9f");
  });

  it("keeps the styles that follow an interpolate curve in a linkStyle", () => {
    const graph = parseFlowchart("flowchart LR\n A-->B\n linkStyle 0 interpolate basis stroke:#f00\n linkStyle default interpolate linear");
    expect(graph.linkStyles.get(0)?.get("stroke")).toBe("#f00");
    expect(graph.linkStyles.has(-1)).toBe(false);
  });

  it("reads the flowchart-elk header and the legacy direction glyphs", () => {
    expect(parseFlowchart("flowchart-elk RL\n A-->B").direction).toBe(Direction.RL);
    expect(parseFlowchart("graph >\n A-->B").direction).toBe(Direction.LR);
    expect(parseFlowchart("graph ^\n A-->B").direction).toBe(Direction.BT);
    expect(parseFlowchart("graph ^\n A-->B").directionDeclared).toBe(true);
  });

  it("keeps %% inside quotes and brackets, and still cuts a trailing comment", () => {
    expect(uncommented('A["100%% sure"] --> B %% note')).toBe('A["100%% sure"] --> B ');
    expect(uncommented("A[100%% sure] --> B")).toBe("A[100%% sure] --> B");
    expect(uncommented("%%{init: {}}%%")).toBe("");
    expect(parseFlowchart('flowchart LR\n A["100%% sure"] --> B').nodes.get("A")?.label).toBe("100%% sure");
  });

  it("reads a labelled invisible link", () => {
    const [edge] = parseFlowchart("flowchart LR\n A ~~~|x| B").edges;
    expect(edge.style).toBe(EdgeStyle.INVISIBLE);
    expect(edge.label).toBe("x");
    expect(ids("flowchart LR\n A ~~~|x| B")).toEqual(["A", "B"]);
  });
});

const BOTH_WAYS = ["TD", "LR"] as const;

describe("the LAST shape and label spelled for a node, as mermaid keeps them", () => {
  it.each(BOTH_WAYS)("lets an explicit rectangle undo an earlier round shape (%s)", (way) => {
    const graph = parseFlowchart(`flowchart ${way}\n A(round)\n A[square]\n A --> B`);
    expect(graph.nodes.get("A")?.shape).toBe(NodeShape.RECTANGLE);
    expect(graph.nodes.get("A")?.label).toBe("square");
  });

  it.each(BOTH_WAYS)("lets an explicit shape undo an earlier one the other way round (%s)", (way) => {
    const graph = parseFlowchart(`flowchart ${way}\n A[square]\n A(round)`);
    expect(graph.nodes.get("A")?.shape).toBe(NodeShape.ROUNDED);
  });

  it.each(BOTH_WAYS)("leaves shape and label alone for a bare mention in an edge (%s)", (way) => {
    const graph = parseFlowchart(`flowchart ${way}\n A(round)\n A --> B`);
    expect(graph.nodes.get("A")?.shape).toBe(NodeShape.ROUNDED);
    expect(graph.nodes.get("A")?.label).toBe("round");
  });

  it.each(BOTH_WAYS)("keeps an earlier label under an `@{ shape: }` that spells none (%s)", (way) => {
    const graph = parseFlowchart(`flowchart ${way}\n A[one]\n A@{ shape: cyl }`);
    expect(graph.nodes.get("A")?.shape).toBe(NodeShape.CYLINDER);
    expect(graph.nodes.get("A")?.label).toBe("one");
  });

  it.each(BOTH_WAYS)("draws the id lines --show-ids writes, the body no longer overwriting them (%s)", (way) => {
    const drawn = render(applyShowIds(`flowchart ${way}\n A[Start] --> B[End]`));
    expect(drawn).toContain("A: Start");
    expect(drawn).toContain("B: End");
  });
});

describe("a `%%{init: ...}%%` line above the header, which mermaid strips before it reads the kind", () => {
  it("leaves the kind to the header, not to the directive", () => {
    expect(declaredType('%%{init: {"theme":"forest"}}%%\nsequenceDiagram\n Alice->>Bob: hi')).toBe("sequenceDiagram");
    expect(declaredType('%%{init: {"theme":"forest"}}%%\npie title Pets\n "Dogs" : 386')).toBe("pie");
    expect(declaredType("%% a note\n%%{init: {}}%%\nstateDiagram-v2\n [*] --> A")).toBe("stateDiagram");
    expect(declaredType('%%{init: {"theme":"forest"}}%%\nflowchart LR\n A --> B')).toBe("flowchart");
  });

  it.each(BOTH_WAYS)("reads the theme it names, as a frontmatter block would (%s)", (way) => {
    const directive = themeAsked(`%%{init: {"theme":"forest"}}%%\nflowchart ${way}\n A --> B`, "default");
    expect(directive.name).toBe("forest");
  });

  it("reads themeVariables, and wins over the frontmatter mermaid merges it onto", () => {
    const named = withConfig({ theme: "dark" }, '%%{init: {"theme":"forest"}}%%\nflowchart LR\n A --> B');
    expect(themeAsked(named, "default").name).toBe("forest");
    const varied = '%%{init: {"theme":"base","themeVariables":{"primaryColor":"#ff0000"}}}%%\nflowchart LR\n A --> B';
    expect(themeAsked(varied, "default").variables.primaryColor).toBe("#ff0000");
  });

  it("still finds the header under the directive when the header is indented, as mermaid's `^\\s*` detectors do", () => {
    expect(declaredType('%%{init: {"theme":"forest"}}%%\n  sequenceDiagram\n    Alice->>Bob: hi')).toBe("sequenceDiagram");
    expect(declaredType('%%{init: {}}%%\n\n\t pie title Pets\n "Dogs" : 386')).toBe("pie");
    expect(render('%%{init: {}}%%\n  sequenceDiagram\n    Alice->>Bob: hi')).toContain("Alice");
  });

  it("leaves the asked theme standing when the directive is unreadable or names none", () => {
    expect(themeAsked("%%{init: {not json}}%%\nflowchart LR\n A --> B", "dark").name).toBe("dark");
    expect(themeAsked('%%{init: {"flowchart":{"curve":"basis"}}}%%\nflowchart LR\n A --> B', "dark").name).toBe("dark");
  });
});


describe("the shapes, the markup and the style properties mermaid draws that used to be dropped", () => {
  const shapeOf = (source: string, id: string): NodeShape | undefined => parseFlowchart(source).nodes.get(id)?.shape;

  it.each(BOTH_WAYS)("names the ODD shape, mermaid's own word for the flag `>text]` (%s)", (way) => {
    expect(shapeOf(`flowchart ${way}\n A@{ shape: odd, label: "Odd" }`, "A")).toBe(NodeShape.ASYMMETRIC);
    expect(render(`flowchart ${way}\n A@{ shape: odd, label: "Flag" }`, { width: 60 })).toBe(
      render(`flowchart ${way}\n A>Flag]`, { width: 60 })
    );
  });

  it.each(BOTH_WAYS)("draws a TEXT BLOCK as its label alone, no outline and no tee cut into it (%s)", (way) => {
    expect(shapeOf(`flowchart ${way}\n A@{ shape: text, label: "Just text" }`, "A")).toBe(NodeShape.TEXT);
    const drawn = render(`flowchart ${way}\n A[Box] --> B@{ shape: text, label: "Just text" } --> C[End]`, { width: 60 });
    const row = drawn.split("\n").find((line) => line.includes("Just text"));
    expect(row).toBeDefined();
    expect(row).not.toMatch(/[│├┤]\s*Just text/u);
    expect(drawn).toContain("End");
  });

  it.each(BOTH_WAYS)("takes `<b>` and `<i>` for the ink they name, as mermaid's HTML labels do (%s)", (way) => {
    const source = `flowchart ${way}\n A["<b>bold</b> and <i>it</i>"]`;
    const graph = parseFlowchart(source);
    expect(graph.nodes.get("A")?.label).toBe("bold and it");
    expect(graph.nodes.get("A")?.labelSegments).toEqual([
      { text: "bold", bold: true, italic: false },
      { text: " and ", bold: false, italic: false },
      { text: "it", bold: false, italic: true },
    ]);
    expect(renderThemed(source, { width: 60 }, "default")).toMatch(/\[3;[^m]*mit/u);
  });

  it.each(BOTH_WAYS)("keeps an escaped comma inside a classDef value, and splits on it anywhere else (%s)", (way) => {
    const graph = parseFlowchart(`flowchart ${way}\n A --> B\n classDef d stroke-dasharray: 9\\,5,stroke:#f00\n style B stroke-dasharray: 9\\,5`);
    expect(graph.classDefs.get("d")?.get("stroke-dasharray")).toBe("9,5");
    expect(graph.classDefs.get("d")?.get("stroke")).toBe("#f00");
    expect(graph.nodeStyles.get("B")?.get("stroke-dasharray")).toBe("9\\");
  });

  it.each(BOTH_WAYS)("paints a label ITALIC or BOLD when the style names the font, as a theme's own CSS does (%s)", (way) => {
    const slanted = `flowchart ${way}\n A[Slanted]\n classDef ii font-style:italic,fill:#eef\n class A ii`;
    expect(renderThemed(slanted, { width: 60 }, "default")).toMatch(/\[[^m]*3;[^m]*mSlanted/u);
    const heavy = `flowchart ${way}\n A[Heavy]\n classDef bb font-weight:bold,fill:#eef\n class A bb`;
    expect(renderThemed(heavy, { width: 60 }, "default")).toMatch(/\[1;[^m]*mHeavy/u);
  });
});

describe("a subgraph's `direction`, read wherever its words stand as mermaid's `.*direction\\s+TB` rule reads them", () => {
  it.each(["TD", "LR"])("reads it after a tab, no node minted, the diagram %s", (way) => {
    const tabbed = `flowchart ${way}\n  subgraph S\n    direction\tRL\n    A --> B\n  end\n`;
    expect(ids(tabbed)).toEqual(["A", "B"]);
    expect(parseFlowchart(tabbed).subgraphs[0].direction).toBe(Direction.RL);
    for (const width of [40, 120]) {
      expect(render(tabbed, { width })).toBe(render(tabbed.replace("\t", " "), { width }));
    }
  });
});
