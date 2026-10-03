import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { computeLayout } from "../../src/graph/layout/passes.js";
import { chainOf } from "../../src/graph/subgraph-tree.js";
import { TWO_PANES } from "../support/drawn.js";

describe("a subgraph's border drawn straight THROUGH a node that is not in it", () => {
  const CASE = "flowchart TB\n    c1-->a2\n    subgraph ide1 [one]\n    a1-->a2\n    end";

  const trespass = (source: string): string | undefined => {
    const graph = parseFlowchart(source);
    const layout = computeLayout(graph, { paddingX: 4, paddingY: 2, gap: 4 });
    for (const bounds of layout.subgraphBounds) {
      for (const [id, at] of layout.placements) {
        if (chainOf(graph, id).has(bounds.subgraph.id)) continue;
        const across = at.drawX < bounds.x + bounds.width && bounds.x < at.drawX + at.drawWidth;
        const down = at.drawY < bounds.y + bounds.height && bounds.y < at.drawY + at.drawHeight;
        if (across && down) return `${id} inside ${bounds.subgraph.id}`;
      }
    }
    return undefined;
  };

  it("keeps the outsider clear of the box, which is where mermaid draws it", () => {
    expect(trespass(CASE)).toBeUndefined();
  });

  it("draws that outsider's own box whole, no border through it", () => {
    expect(render(CASE, { width: 90 })).toContain("\u2502  c1  \u2502");
  });

  it("holds whichever way the flow runs", () => {
    for (const direction of ["TB", "BT", "LR", "RL"]) {
      const source = CASE.replace("flowchart TB", `flowchart ${direction}`);
      expect([direction, trespass(source)]).toEqual([direction, undefined]);
    }
  });

  it("holds with an outsider on each side of the box", () => {
    expect(trespass("flowchart TB\n  g-->a2\n  d-->a2\n  subgraph ide1 [one]\n  a1-->a2\n  end")).toBeUndefined();
  });

  it("holds where a bare node stands between two boxes", () => {
    const source =
      "flowchart TB\n  c1-->a2\n  subgraph one\n  a1-->a2\n  end\n  subgraph two\n  b1-->b2\n  end\n  a2-->b1";
    expect(trespass(source)).toBeUndefined();
  });

  it("leaves a box with no outsider in its layers laid out as it was", () => {
    const source = "flowchart TB\n  subgraph one\n  a1-->a2\n  end\n  a2-->b1";
    expect(trespass(source)).toBeUndefined();
    expect(render(source, { width: 90 })).toContain("a1");
  });
});

describe("two subgraphs no edge names, set side by side and not one under the other", () => {
  const beside =
    "flowchart TD\n" +
    "    subgraph leftbox\n        A[a1] --> B[a2] --> F[a3]\n    end\n" +
    "    subgraph rightbox\n        C[b1] --> D[b2]\n    end\n" +
    "    A --> C\n";
  const stacked = `${beside}    leftbox --> rightbox\n`;

  const rowOf = (drawn: string, text: string): number => drawn.split("\n").findIndex((row) => row.includes(text));

  it.each(TWO_PANES)("opens the second box beside the first and not under it, at width %i", (width) => {
    const rows = render(beside, { width }).split("\n");
    const last = rows.reduce((found, row, at) => (row.includes("a3") ? at : found), -1);
    expect(rowOf(rows.join("\n"), "rightbox")).toBeGreaterThan(rowOf(rows.join("\n"), "leftbox"));
    expect(rowOf(rows.join("\n"), "rightbox")).toBeLessThan(last);
  });

  it.each(TWO_PANES)("runs their nodes in step, at width %i", (width) => {
    const drawn = render(beside, { width });
    const paired: ReadonlyArray<readonly [string, string]> = [
      ["a2", "b1"],
      ["a3", "b2"],
    ];
    for (const [left, right] of paired) {
      expect(rowOf(drawn, left)).toBe(rowOf(drawn, right));
      const row = drawn.split("\n")[rowOf(drawn, left)];
      expect(row.indexOf(left)).toBeLessThan(row.indexOf(right));
    }
  });

  it.each(TWO_PANES)("keeps the name of a box off the run coming into it, at width %i", (width) => {
    const rows = render(beside, { width }).split("\n");
    const named = rows.findIndex((row) => row.includes("rightbox"));
    expect(named).toBeGreaterThan(-1);
    for (const mark of ["┼", "╮", "╰", "─"]) expect(rows[named]).not.toContain(mark);
    const frame = rows[named].indexOf("rightbox") - 2;
    expect(rows.slice(named + 1).some((row) => row[frame] === "─")).toBe(true);
  });

  it.each(TWO_PANES)("stacks the two an edge NAMES, at width %i", (width) => {
    const drawn = render(stacked, { width });
    expect(rowOf(drawn, "leftbox")).toBeLessThan(rowOf(drawn, "rightbox"));
    expect(rowOf(drawn, "a3")).toBeLessThan(rowOf(drawn, "b1"));
  });
});

describe("the direction a SUBGRAPH declares, honoured whatever the graph around it does", () => {
  const corps =
    "\n    subgraph amont\n        direction TD\n      A[capteur] --> B[filtre]\n    end" +
    "\n    subgraph aval\n        direction LR\n        C[agrege] --> D[stocke]\n    end" +
    "\n    amont --> aval\n    aval --> E[tableau]\n";
  const rowOf = (drawn: string, label: string): number =>
    drawn.split("\n").findIndex((row) => row.includes(label));

  it.each(["flowchart", "flowchart LR", "flowchart TD"])("draws `direction LR` as a row under %s", (tete) => {
    const drawn = render(tete + corps);
    expect(rowOf(drawn, "agrege")).toBe(rowOf(drawn, "stocke"));
    expect(rowOf(drawn, "agrege")).toBeGreaterThanOrEqual(0);
  });

  it.each(["flowchart", "flowchart LR", "flowchart TD"])("draws `direction TD` as a column under %s", (tete) => {
    const drawn = render(tete + corps);
    const capteur = rowOf(drawn, "capteur");
    const filtre = rowOf(drawn, "filtre");
    expect(capteur).toBeGreaterThanOrEqual(0);
    expect(filtre).toBeGreaterThan(capteur);
  });

  it("lets a subgraph declaring NOTHING follow the flow around it", () => {
    const libre = "flowchart LR\n    subgraph aval\n        D[stocke] --> E[publie]\n    end\n    A[collecteur] --> aval\n";
    const drawn = render(libre);
    expect(rowOf(drawn, "stocke")).toBe(rowOf(drawn, "publie"));
  });
});

describe("a subgraph's own direction read as a SENSE and not as the axis alone", () => {
  const rowOf = (drawn: string, label: string): number =>
    drawn.split("\n").findIndex((row) => row.includes(label));
  const colOf = (drawn: string, label: string): number => {
    for (const row of drawn.split("\n")) {
      const at = row.indexOf(label);
      if (at !== -1) return at;
    }
    return -1;
  };
  const boxed = (graph: string, sub: string): string =>
    render(`flowchart ${graph}\n  subgraph S\n    direction ${sub}\n    ii --> ff\n  end`, { width: 80 });

  it("puts the far end where the sense says, on every pairing of a graph and a box", () => {
    for (const graph of ["LR", "RL", "TB", "BT"]) {
      const drawn = Object.fromEntries(["LR", "RL", "TB", "BT"].map((sub) => [sub, boxed(graph, sub)]));
      for (const sub of ["LR", "RL"]) {
        const one = drawn[sub];
        expect(rowOf(one, "ii")).toBe(rowOf(one, "ff"));
      }
      for (const sub of ["TB", "BT"]) {
        const one = drawn[sub];
        expect(colOf(one, "ii")).toBe(colOf(one, "ff"));
      }
      expect(colOf(drawn["LR"], "ff")).toBeGreaterThan(colOf(drawn["LR"], "ii"));
      expect(colOf(drawn["RL"], "ff")).toBeLessThan(colOf(drawn["RL"], "ii"));
      expect(rowOf(drawn["TB"], "ff")).toBeGreaterThan(rowOf(drawn["TB"], "ii"));
      expect(rowOf(drawn["BT"], "ff")).toBeLessThan(rowOf(drawn["BT"], "ii"));
    }
  });

  it("keeps a box read backwards on ONE track, its arrow flat from end to end", () => {
    const drawn = render(
      "flowchart LR\n  subgraph one\n    direction RL\n    archive --> sorted\n  end\n" +
        "  subgraph two\n    direction BT\n    read --> checked\n  end",
      { width: 80 }
    );
    const centre = (label: string): number => colOf(drawn, label) + label.length / 2;
    expect(rowOf(drawn, "archive")).toBe(rowOf(drawn, "sorted"));
    expect(Math.abs(centre("read") - centre("checked"))).toBeLessThanOrEqual(1);
  });

  it("hands a box that names no direction to the graph, exactly as before", () => {
    const drawn = render("flowchart LR\n  subgraph S\n    ii --> ff\n  end", { width: 80 });
    expect(rowOf(drawn, "ii")).toBe(rowOf(drawn, "ff"));
    expect(colOf(drawn, "ff")).toBeGreaterThan(colOf(drawn, "ii"));
  });

  it("stacks the boxes a parent runs across, edge between them or not", () => {
    const nested = (edge: string): string =>
      render(
        "flowchart LR\n  subgraph TOP\n    direction TB\n    subgraph B1\n      aa --> bb\n    end\n" +
          `    subgraph B2\n      cc --> dd\n    end\n  end\n${edge}`,
        { width: 90 }
      );
    // With no link between them mermaid hands B2 over first, the last closed: it stands above B1. The link puts B1 first.
    const apart = nested("");
    expect(rowOf(apart, "cc")).toBeLessThan(rowOf(apart, "bb"));
    expect(colOf(apart, "aa")).toBe(colOf(apart, "cc"));
    const linked = nested("  B1 --> B2");
    expect(rowOf(linked, "cc")).toBeGreaterThan(rowOf(linked, "bb"));
    expect(colOf(linked, "aa")).toBe(colOf(linked, "cc"));
  });

  it("leaves the graph it was handed exactly as it found it, mirror and all", () => {
    const source = "flowchart RL\n  subgraph S\n    direction LR\n    ii --> ff\n  end";
    const graph = parseFlowchart(source);
    const before = graph.subgraphs.map((sg) => sg.direction);
    render(source, { width: 80 });
    expect(parseFlowchart(source).subgraphs.map((sg) => sg.direction)).toEqual(before);
    expect(render(source, { width: 80 })).toBe(render(source, { width: 80 }));
  });
});

describe("a run into the FIRST box of a named frame, the name written across the lane it arrives by", () => {
  const FRAME = ["  subgraph us [US East Region]", "    A[Web Server] --> B[App Server]", "  end"];
  const alone = (direction: string): string => [`flowchart ${direction}`, ...FRAME].join("\n");
  const arrived = (direction: string): string => [alone(direction), "  E[Load Balancer] --> A"].join("\n");

  const rowOf = (drawn: string, text: string): number => drawn.split("\n").findIndex((line) => line.includes(text));
  const under = (drawn: string, rows: number): string => drawn.split("\n")[rowOf(drawn, "US East Region") + rows];

  it("carries the run under the name, the head landing on the box and not on the text", () => {
    for (const borders of ["default", "padless"] as const) {
      const drawn = render(arrived("TD"), { width: 60, borders });
      const at = under(drawn, 2).indexOf("\u23F7");
      expect([borders, at]).not.toEqual([borders, -1]);
      expect([borders, under(drawn, 1)[at]]).toEqual([borders, "\u2502"]);
    }
  });

  it("spends that row where the name stands in the way, and nowhere else", () => {
    for (const [direction, spent] of [["TD", 1], ["LR", 0], ["BT", 0]] as const) {
      for (const borders of ["default", "padless"] as const) {
        const depth = (source: string): number => {
          const drawn = render(source, { width: 80, borders });
          return rowOf(drawn, "Web Server") - rowOf(drawn, "US East Region");
        };
        const read = [direction, borders, depth(arrived(direction)) - depth(alone(direction))];
        expect(read).toEqual([direction, borders, spent]);
      }
    }
  });
});
