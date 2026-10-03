import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { type Edge } from "../../src/graph/model.js";
import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { computeLayout } from "../../src/graph/layout/passes.js";
import { chainOf } from "../../src/graph/subgraph-tree.js";
import { must } from "../../src/must.js";

describe("two boxes drawn one OVER the other, which the ordering had nothing to stop", () => {
  const BRACKET = "flowchart TB\n  subgraph one\n  a1\n  a2\n  end\n  subgraph two\n  b1\n  end\n  a1-->b1\n  b1-->a2";
  const THREE = [
    "flowchart TB",
    "  c1-->a2",
    "  subgraph one",
    "  a1-->a2",
    "  end",
    "  subgraph two",
    "  b1-->b2",
    "  end",
    "  subgraph three",
    "  c1--->c2",
    "  end",
    "  one --> two",
    "  three --> two",
    "  two --> c2",
  ].join("\n");

  const covered = (source: string): string[] => {
    const graph = parseFlowchart(source);
    const layout = computeLayout(graph, { paddingX: 4, paddingY: 2, gap: 4 });
    const hits: string[] = [];
    const over = (a: { x: number; y: number; width: number; height: number }, bx: number, by: number, bw: number, bh: number): boolean =>
      bx < a.x + a.width && a.x < bx + bw && by < a.y + a.height && a.y < by + bh;
    for (const box of layout.subgraphBounds) {
      for (const [id, at] of layout.placements) {
        if (chainOf(graph, id).has(box.subgraph.id)) continue;
        if (over(box, at.drawX, at.drawY, at.drawWidth, at.drawHeight)) hits.push(`${id} sous ${box.subgraph.id}`);
      }
      for (const other of layout.subgraphBounds) {
        if (other === box) continue;
        const nested = (inner: typeof box, outer: typeof box): boolean => {
          for (let sg = inner.subgraph.parent; sg !== undefined; sg = sg.parent) if (sg === outer.subgraph) return true;
          return false;
        };
        if (nested(other, box) || nested(box, other)) continue;
        if (over(box, other.x, other.y, other.width, other.height)) {
          hits.push([box.subgraph.id, other.subgraph.id].sort().join(" sur "));
        }
      }
    }
    return [...new Set(hits)];
  };

  it("keeps a box that BRACKETS another clear of it", () => {
    expect(covered(BRACKET)).toEqual([]);
  });

  it("keeps mermaid's three subgraphs apart, the long run included", () => {
    expect(covered(THREE)).toEqual([]);
  });

  it("holds whichever way the flow runs", () => {
    for (const direction of ["TB", "BT", "LR", "RL"]) {
      for (const source of [BRACKET, THREE]) {
        const turned = source.replace("flowchart TB", `flowchart ${direction}`);
        expect([direction, covered(turned)]).toEqual([direction, []]);
      }
    }
  });

  it("leaves a box NESTED in another nested, which is where it belongs", () => {
    const source =
      "flowchart TB\n  subgraph dehors\n  subgraph dedans\n  x1-->x2\n  end\n  x2-->x3\n  end\n" +
      "  subgraph autre\n  y1\n  end\n  x1-->y1\n  y1-->x3";
    expect(covered(source)).toEqual([]);
    const drawn = render(source, { width: 90 });
    expect(drawn).toContain("\u2502 \u250c");
    expect(drawn).toContain("autre");
  });

  it("lets bands whose layers never meet share a track, so a chain of boxes stays one column wide", () => {
    const stacked = "flowchart TB\n  subgraph un\n  a1-->a2\n  end\n  subgraph deux\n  b1-->b2\n  end\n  a2-->b1";
    expect(covered(stacked)).toEqual([]);
    const graph = parseFlowchart(stacked);
    const layout = computeLayout(graph, { paddingX: 4, paddingY: 2, gap: 4 });
    const boxes = layout.subgraphBounds;
    expect(boxes).toHaveLength(2);
    expect(boxes[0].x).toBe(boxes[1].x);
  });

  it("keeps a composite state whole, its box and its node carrying the one name", () => {
    const source =
      "stateDiagram-v2\n  [*] --> Active\n  Active --> [*]\n  state Active {\n    Ready --> Working : pick\n" +
      "    Working --> Done : finish\n  }";
    expect(covered(source.replace("stateDiagram-v2", "flowchart TB"))).toEqual([]);
    const drawn = render(source, { width: 80 });
    expect(drawn.split("\n").findIndex((row) => row.includes("Active"))).toBeLessThan(
      drawn.split("\n").findIndex((row) => row.includes("Ready"))
    );
  });
});

describe("a flattened box gives back the layers its inside claimed, no empty layer left between boxes", () => {
  const source = `flowchart
    subgraph amont
        direction TD
        A[capteur] --> B[filtre]
    end
    subgraph aval
        direction TD
        C[agrege] --> D[stocke]
    end
    amont --> aval
    aval --> E[tableau]`;

  it.each([[90], [60]])("keeps the boxes one stride apart at width %d", (width) => {
    const drawn = render(source, { width });
    expect(Math.max(...drawn.split("\n").map((l) => l.length))).toBeLessThanOrEqual(60);
    expect((drawn.match(/[\u23f6\u23f7\u23f4\u23f5]/gu) ?? []).length).toBe(4);
  });
});

describe("a box fed by NAME follows its feeding edge, which pulled nothing through the subgraph id", () => {
  const source =
    "flowchart\n    subgraph sources\n        A[capteur un]\n        B[capteur deux]\n    end\n" +
    "    A --> C[collecteur]\n    B --> C\n    C --> aval\n    subgraph aval\n        D[stocke] --> E[publie]\n    end\n";

  it("centres the fed box on the row its feeding edge arrives from", () => {
    const rows = render(source, { width: 100 }).split("\n");
    const at = rows.findIndex((row) => row.includes("collecteur"));
    expect(at).toBeGreaterThan(0);
    expect(rows[at]).toContain("stocke");
    expect(rows[at]).toContain("publie");
  });

  it("pulls by an anchored box's CENTRE, never by the member the edge happens to enter", () => {
    const down =
      "flowchart TD\n    subgraph sources\n        A[capteur un]\n        B[capteur deux]\n    end\n" +
      "    A --> C[collecteur]\n    B --> C\n    C --> aval\n" +
      "    subgraph aval\n        direction LR\n        D[stocke] --> E[publie]\n    end\n";
    const rows = render(down, { width: 76 }).split("\n");
    const heads = must(rows.find((row) => row.includes("capteur un")));
    const middle = must(rows.find((row) => row.includes("collecteur")));
    expect(middle.indexOf("collecteur")).toBeGreaterThan(heads.indexOf("capteur un") + "capteur un".length);
    expect(middle.indexOf("collecteur") + "collecteur".length).toBeLessThan(heads.indexOf("capteur deux"));
  });
});

describe("a box the author FOLDED, `one@{ view: collapsed }`", () => {
  const source = (tail: string): string =>
    `flowchart TD\n  Start --> one\n  subgraph one [My Group]\n    A --> B\n    B --> C\n  end\n  one --> End\n${tail}`;
  const FOLDED = source("  one@{ view: collapsed }");

  it("draws the box as one node carrying its name, and what it holds not at all", () => {
    const rows = render(FOLDED, { width: 60 }).split("\n");
    const named = rows.findIndex((row) => row.includes("My Group"));
    expect(named).toBeGreaterThan(-1);
    expect(rows[named + 1]).toMatch(/^│ ─+ │$/u);
    expect(rows[named + 2]).toContain("•••");
    expect(rows[named]).toMatch(/^│.*│$/u);
    for (const member of ["A", "B", "C"]) expect(render(FOLDED, { width: 60 })).not.toContain(`│    ${member}    │`);
  });

  it("draws the rule FAINT, a line carrying no data being drawn that way everywhere else", () => {
    const painted = renderThemed(FOLDED, { width: 60 }, "classic");
    const rule = painted.split("\n").find((row) => row.includes("\u001b[2;90m─"));
    expect(rule).toBeDefined();
    expect(must(rule)).not.toMatch(/^\u001b\[2;90m/u);
  });

  it("invents no node for the line that folds it", () => {
    const graph = parseFlowchart(FOLDED);
    expect(graph.nodes.get("one")?.label).toBe("My Group");
    expect(graph.subgraphs.some((sg) => sg.id === "one")).toBe(false);
    for (const member of ["A", "B", "C"]) expect(graph.nodes.has(member)).toBe(false);
  });

  it("hands every edge that reached inside to the node standing for it, and drops the ones with both ends in", () => {
    const graph = parseFlowchart(FOLDED);
    const drawnEdges = graph.edges.map((e: Edge) => `${e.source}->${e.target}`);
    expect(drawnEdges).toEqual(["Start->one", "one->End"]);
    const inner = parseFlowchart(
      "flowchart TD\n  Start --> A\n  subgraph one [My Group]\n    A --> B\n  end\n  B --> End\n  one@{ view: collapsed }"
    );
    expect(inner.edges.map((e: Edge) => `${e.source}->${e.target}`)).toEqual(["Start->one", "one->End"]);
  });

  it("draws the OUTERMOST fold and nothing under it", () => {
    const graph = parseFlowchart(
      "flowchart TD\n  subgraph a [A]\n    subgraph b [B]\n      x --> y\n    end\n  end\n" +
        "  a@{ view: collapsed }\n  b@{ view: collapsed }\n  S --> a"
    );
    expect(graph.nodes.has("a")).toBe(true);
    expect(graph.nodes.has("b")).toBe(false);
    expect(graph.subgraphs).toHaveLength(0);
  });

  it("keeps a fold nested in a box that is not folded inside it", () => {
    const graph = parseFlowchart(
      "flowchart TD\n  subgraph dehors [Dehors]\n    subgraph dedans [Dedans]\n      x --> y\n    end\n" +
        "    z --> x\n  end\n  A --> z\n  dedans@{ view: collapsed }"
    );
    const outer = graph.subgraphs.find((sg) => sg.id === "dehors");
    expect(outer?.children).toHaveLength(0);
    expect(outer?.nodeIds).toContain("dedans");
    expect(graph.edges.map((e: Edge) => `${e.source}->${e.target}`)).toEqual(["z->dedans", "A->z"]);
  });

  it("leaves a box nobody folded exactly as it was", () => {
    const graph = parseFlowchart(source(""));
    expect(graph.subgraphs.map((sg) => sg.id)).toEqual(["one"]);
    expect(graph.nodes.has("A")).toBe(true);
    expect(graph.nodes.has("one")).toBe(false);
  });
});
