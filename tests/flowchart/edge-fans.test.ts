import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { TWO_PANES, widest } from "../support/drawn.js";

describe("the runs of a fan nested inside one another, never braided", () => {
  const noCrossing = (drawn: string): void => {
    for (const row of drawn.split("\n")) expect(row).not.toMatch(/[┼┿╂]/u);
  };

  it.each(TWO_PANES)("brings four edges into one node without a crossing, at width %i", (width) => {
    const source =
      "graph TD\n    A[Source] --> H[Hub]\n    B[Autre] -->|oui| H\n    C[Tiers] -.->|non| H\n" +
      "    D[Quatre] ==> H\n    H --> E[Sortie]\n    H -->|peut etre| F[Erreur]\n";
    noCrossing(render(source, { width }));
  });

  it.each(TWO_PANES)("sends three edges out of one node without a crossing, at width %i", (width) => {
    noCrossing(render("graph TD\n    A --> B\n    A -.-> C\n    A ==> D\n", { width }));
  });

  it("gives the run that goes farthest the lane hugging the node they share", () => {
    const source =
      "graph TD\n    A[Source] --> H[Hub]\n    B[Autre] -->|oui| H\n    C[Tiers] -.->|non| H\n" +
      "    D[Quatre] ==> H\n";
    const rows = render(source, { width: 80 }).split("\n");
    const heads = rows.findIndex((row) => (row.match(/⏷/gu) ?? []).length === 4);
    expect(rows[heads].match(/⏷/gu)).toHaveLength(4);
    const turnsOn = (stroke: string): number =>
      rows.slice(0, heads).reduce((found, row, at) => (row.includes(stroke) ? at : found), -1);
    const dotted = turnsOn("┄");
    const thick = turnsOn("━");
    expect(dotted).toBeGreaterThan(0);
    expect(thick).toBeGreaterThan(dotted);
  });
});

describe("edges leaving one node on one cell, never a trunk they share", () => {

  it.each(TWO_PANES)("gives each departure a mark of its own on the border, at width %i", (width) => {
    const drawn = render("flowchart TD\n    A[entree] --> B[premiere etape]\n    A --> C[voie de cote]\n", { width });
    const border = drawn.split("\n").find((row) => row.includes("└")) ?? "";
    expect((border.match(/┬/gu) ?? []).length).toBe(2);
  });

  it.each(TWO_PANES)("moves the one that TURNS and leaves the straight run its cell, at width %i", (width) => {
    const rows = render(
      "flowchart TD\n    A[entree] --> B[premiere etape]\n    A --> C[voie de cote]\n    A --> D[troisieme voie]\n",
      { width }
    ).split("\n");
    const columns = (line: string, mark: string): number[] =>
      [...line].flatMap((cell, at) => (cell === mark ? [at] : []));
    const tails = columns(rows.find((row) => row.includes("└")) ?? "", "┬");
    const heads = columns(rows.find((row) => row.includes("⏷")) ?? "", "⏷");
    expect(tails).toHaveLength(3);
    expect(heads).toHaveLength(3);
    expect(tails[1]).toBe(heads[1]);
  });

  it.each(TWO_PANES)("spreads along the side the run leaves by, at width %i", (width) => {
    const rows = render("flowchart LR\n    A[porte] --> B[suite]\n    A --> C[cote]\n", { width }).split("\n");
    const tails = rows.map((row, at) => [at, row.indexOf("├")] as const).filter(([, col]) => col >= 0);
    expect(tails).toHaveLength(2);
    expect(new Set(tails.map(([, col]) => col)).size).toBe(1);
  });

  const three = "graph LR\n    A[Entree] -->|premier| B[Milieu]\n    A -.->|second| C[Cote]\n" +
    "    A ==>|troisieme| D[Gros]\n    B -->|quatrieme| D\n    C -.-> D\n";

  it.each(TWO_PANES)("carries the fan PAST the middle where the side it turns toward is full, at width %i", (width) => {
    const rows = render(three, { width }).split("\n");
    const tails = rows.map((row, at) => [at, row.search(/[\u251c\u251d]/u)] as const).filter(([, col]) => col >= 0);
    expect(tails).toHaveLength(3);
    expect(new Set(tails.map(([, col]) => col)).size).toBe(1);
    expect(new Set(tails.map(([at]) => at)).size).toBe(3);
  });

  it("keeps every name the author wrote while it does, at width 80", () => {
    const drawn = render(three, { width: 80 });
    for (const label of ["premier", "second", "troisieme", "quatrieme"]) expect(drawn).toContain(label);
    expect(drawn).not.toContain("…");
  });

  it("keeps `second` whole at 40 now that the drawing fits, and MARKS a label a band cannot hold rather than shortening it in silence", () => {
    const drawn = render(three, { width: 40 });
    for (const label of ["premier", "second", "troisieme", "quatrieme"]) expect(drawn).toContain(label);
    expect(drawn).not.toContain("…");
    const long = three.replace("|second|", "|second label that runs on and on|");
    const marked = render(long, { width: 40 });
    expect(marked).toMatch(/\bse…/u);
    expect(marked).not.toContain("second label");
    for (const label of ["premier", "troisieme", "quatrieme"]) expect(marked).toContain(label);
  });

  it("never seats a run on the wrong side of the cell it attaches to", () => {
    const fan = "flowchart\n    A{binaire present} -->|oui| B[dessine]\n    A -->|non| C[texte brut]\n";
    for (const options of [{ paddingY: 0 }, { width: 60, height: 8 }, { width: 35 }, {}]) {
      const drawn = render(fan, options);
      expect(drawn).not.toMatch(/├─*│/u);
      const tails = drawn.split("\n").map((row) => row.indexOf("├")).filter((col) => col >= 0);
      expect(tails).toHaveLength(2);
      expect(new Set(tails).size).toBe(1);
    }
  });

  it("gives a border of TWO cells a third, a fan having no middle to attach on", () => {
    const both = "flowchart\n    subgraph gauche\n        A[a1] --> B[a2] --> F[a3]\n    end\n" +
      "    subgraph droite\n        C[b1] --> D[b2]\n    end\n    A --> C\n";
    for (const options of [{ paddingY: 0 }, { width: 20, height: 8 }]) {
      const drawn = render(both, options);
      expect(drawn).not.toMatch(/├─*│/u);
      const tails = drawn.split("\n").filter((row) => /├─*[⏵╮╯]/u.test(row));
      expect(tails).toHaveLength(3);
    }
  });

  it.each(TWO_PANES)("GROWS the box where the whole border is full, at width %i", (width) => {
    const rows = render(
      "graph LR\n    A[Entree] --> B[Un]\n    A --> C[Deux]\n    A --> D[Trois]\n    A --> E[Quatre]\n",
      { width }
    ).split("\n");
    const tails = rows.map((row, at) => [at, row.indexOf("├")] as const).filter(([, col]) => col >= 0);
    expect(tails).toHaveLength(4);
    expect(new Set(tails.map(([, col]) => col)).size).toBe(1);
    const box = rows.filter((row) => row.startsWith("┌") || row.startsWith("│") || row.startsWith("└"));
    expect(box.length).toBeGreaterThan(5);
  });
});

describe("a fan's arrivals kept apart at every budget, never merged onto one head", () => {
  const heads = (drawn: string): number => (drawn.match(/[⏵⏴⏶⏷]/gu) ?? []).length;
    const pair = "flowchart LR\n    A[capteur un] --> C[collecteur]\n    B[capteur deux] --> C\n";
  const seven =
    "flowchart LR\n    A[a] --> X[x]\n    A --> Y[y]\n    B[b] --> X\n    B --> Y\n    C[c] --> X\n    C --> Z[z]\n    B --> Z\n";

  it("gives each of two arrivals a head of its own with no budget announced at all", () => {
    expect(heads(render(pair))).toBe(2);
  });

  it.each([20, 24, 28, 32, 40, 80, 200])("keeps them apart at width %i, however tight", (width) => {
    expect(heads(render(pair, { width }))).toBe(2);
  });

  it.each([40, 80, 146, 200])("draws all seven of a crossing pair of layers at width %i", (width) => {
    expect(heads(render(seven, { width }))).toBe(7);
  });

  it("asks nothing of a fan LEAVING a node, which its own spread seats on the border", () => {
    const out = "flowchart LR\n    A[porte] --> B[un]\n    A --> C[deux]\n    A --> D[trois]\n";
    const into = "flowchart LR\n    B[un] --> A[porte]\n    C[deux] --> A\n    D[trois] --> A\n";
    expect(widest(render(into, { compact: false }))).toBe(widest(render(out, { compact: false })) + 1);
  });

  it("asks nothing of an arrival that comes BACK, which is brought in round the layers", () => {
    const back = "flowchart LR\n    A[porte] --> B[un]\n    B --> C[deux]\n    C --> A\n    B --> A\n";
    const forward = "flowchart LR\n    A[porte] --> B[un]\n    B --> C[deux]\n";
    expect(widest(render(back))).toBe(widest(render(forward)));
  });

  it("asks nothing of a drawing that runs DOWN the page, where the seats are along a row", () => {
    const down = "flowchart TD\n    A[a] --> X[x]\n    B[b] --> X\n";
    expect(widest(render(down))).toBe(widest(render(down, { width: 200 })));
    expect(heads(render(down))).toBe(2);
  });
});
