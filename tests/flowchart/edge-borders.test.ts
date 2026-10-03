import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { computeLayout } from "../../src/graph/layout/passes.js";
import { must } from "../../src/must.js";
import { TWO_PANES } from "../support/drawn.js";

describe("two ends of one border ordered by the side they come from, never crossed over", () => {
  const source =
    "graph LR\n    A[Entree] -->|premier| B[Milieu]\n    A -.->|second| C[Cote]\n    A ==>|troisieme| D[Gros]\n" +
    "    B -->|quatrieme| D\n    C -.-> D\n";

  it.each(TWO_PANES)("never runs one arrival's line under another's head, at width %i", (width) => {
    const rows = render(source, { width }).split("\n");
    const heads = rows.filter((row) => (row.match(/⏷/gu) ?? []).length > 1);
    expect(heads.length).toBeGreaterThan(0);
    for (const row of heads) expect(row).not.toMatch(/⏷[─━┄]+⏷/u);
  });

  it.each(TWO_PANES)("leaves each end by the side it goes to, at width %i", (width) => {
    const braid =
      "flowchart TD\n    A[a] --> X[x]\n    A --> Y[y]\n    B[b] --> X\n    B --> Y\n    C[c] --> X\n" +
      "    C --> Z[z]\n    B --> Z\n";
    const drawn = render(braid, { width });
    expect((drawn.match(/[┼┿╂]/gu) ?? []).length).toBeLessThanOrEqual(1);
  });
});

describe("a node border left bare behind every arrowhead, no tee cut into it", () => {
  it.each(TWO_PANES)("leaves the border bare where a head already points at the box, at width %i", (width) => {
    const across = render("flowchart LR\n    A[un] --> B[deux]\n", { width }).split("\n");
    expect(across.find((row) => row.includes("⏵")) ?? "").not.toContain("┤");
    const down = render("flowchart TD\n    A[un] --> B[deux]\n", { width }).split("\n");
    const head = down.findIndex((row) => row.includes("⏷"));
    expect(down[head + 1]).toMatch(/^\s*┌[─]+┐\s*$/u);
  });

  it.each(TWO_PANES)("leaves it bare above a lone two-way head as well, at width %i", (width) => {
    const rows = render("flowchart TD\n    A[entree] <--> B[etape]\n", { width }).split("\n");
    const head = rows.find((row) => row.includes("⏶")) ?? "";
    expect((rows.find((row) => row.includes("└")) ?? "")[head.indexOf("⏶")]).toBe("─");
  });

  it.each(TWO_PANES)("marks it for a two-way edge where a sibling marked it already, at width %i", (width) => {
    const rows = render("flowchart TD\n    A[entree] <--> B[etape]\n    A --> Z[cote]\n", { width }).split("\n");
    const head = rows.find((row) => row.includes("⏶")) ?? "";
    const border = rows.find((row) => row.includes("└")) ?? "";
    expect(border[head.indexOf("⏶")]).toBe("┬");
    expect((border.match(/┬/gu) ?? []).length).toBe(2);
  });

  it("still tees an end that carries no arrowhead at all", () => {
    expect(render("flowchart LR\n    A[un] --- B[deux]\n", { width: 60 })).toMatch(/├─+┤/u);
  });
});

describe("an edge into a subgraph BOX whole at every width, head, line and seat of its own", () => {
  const source = `flowchart
    A[un] --> cible
    B[deux] --> cible
    subgraph cible
        C[coeur] --> D[peau]
    end
    cible --> E[fin]`;

  const heads = (drawn: string): number => (drawn.match(/[\u23f6\u23f7\u23f4\u23f5]/gu) ?? []).length;

  it.each([[80], [40], [35], [30], [25]])("draws all four heads at width %d", (width) => {
    const drawn = render(source, { width });
    expect(heads(drawn)).toBe(4);
    expect(drawn).not.toContain("\u23f6");
  });
});

describe("an edge naming a BOX, not layered as though the box were one node", () => {
  const source =
    "flowchart LR\n  subgraph TOP\n    subgraph B1\n      aa --> bb\n    end\n" +
    "    subgraph B2\n      cc --> dd\n    end\n  end\n  A --> TOP --> B";

  const columns = (): Map<string, number> => {
    const layout = computeLayout(parseFlowchart(source));
    return new Map([...layout.placements].map(([id, at]) => [id, at.grid.col]));
  };

  it("puts the far end past the WHOLE box, never in the middle of its span", () => {
    const col = columns();
    const members = ["aa", "bb", "cc", "dd"].map((id) => must(col.get(id)));
    expect(must(col.get("B"))).toBeGreaterThan(Math.max(...members));
    expect(must(col.get("A"))).toBeLessThan(Math.min(...members));
  });

  it("keeps it on the flow, on a row of the box and not under it", () => {
    const drawn = render(source, { width: 90 });
    const rowOf = (label: string): number => drawn.split("\n").findIndex((row) => row.includes(label));
    expect(rowOf("  B  ")).toBe(rowOf("  A  "));
  });
});
