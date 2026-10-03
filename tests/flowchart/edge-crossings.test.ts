import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { must } from "../../src/must.js";
import { TWO_PANES } from "../support/drawn.js";

describe("two runs that INTERLEAVE, each sent round its own side", () => {
  const RETHINK = `flowchart TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    C --> D[Rethink]
    D --> B
    B ---->|No| E[End]`;

  const UPRIGHT = "\u2502\u250a\u2503";
  const FLAT = "\u2500\u2504\u2501";
  const crossings = (drawn: string): number => {
    let found = 0;
    for (const row of drawn.split("\n")) {
      for (let at = 1; at < row.length - 1; at++) {
        const here = row[at];
        if (!UPRIGHT.includes(here)) continue;
        if (FLAT.includes(row[at - 1]) && FLAT.includes(row[at + 1])) found++;
      }
    }
    return found;
  };

  const laned = (drawn: string): boolean => !drawn.split("\n").some((row) => row.startsWith("\u250c"));

  it("draws the loop home and the long run on opposite sides, neither crossing the other", () => {
    expect(crossings(render(RETHINK, { width: 80 }))).toBe(0);
  });

  it("counts a crossing where one really is, so the measure above is not blind", () => {
    expect(crossings("\u2570\u2500\u2500\u2502\u2500\u2500\u256e")).toBe(1);
    expect(crossings("\u2570\u2500\u2500\u2500\u2500\u256e")).toBe(0);
  });

  it("holds in all four directions, the lane being the near side whichever way the flow runs", () => {
    for (const direction of ["TD", "BT", "LR", "RL"]) {
      const drawn = render(RETHINK.replace("flowchart TD", `flowchart ${direction}`), { width: 100 });
      expect([direction, crossings(drawn)]).toEqual([direction, 0]);
    }
  });

  it("gives two loops home that interleave one side each", () => {
    const source = "flowchart TD\n  A --> B\n  B --> C\n  C --> D\n  D --> E\n  D --> B\n  E --> C";
    expect(crossings(render(source, { width: 90 }))).toBe(0);
  });

  it("gives two long runs that interleave one side each", () => {
    const source = "flowchart TD\n  A --> B\n  B --> C\n  C --> D\n  D --> E\n  A ---->|x| D\n  B ----->|y| E";
    expect(crossings(render(source, { width: 90 }))).toBe(0);
  });

  it("sends a NESTED pair round opposite sides, neither crossing the other", () => {
    const nested = "flowchart TD\n  A --> B\n  B --> C\n  C --> D\n  D --> A\n  A ---->|x| D";
    expect(crossings(render(nested, { width: 90 }))).toBe(0);
  });

  it("leaves a lone loop home on the right, where it has always gone", () => {
    const lone = "flowchart TD\n  A --> B\n  B --> C\n  C --> D\n  D --> B";
    const drawn = render(lone, { width: 90 });
    expect(laned(drawn)).toBe(false);
    expect(crossings(drawn)).toBe(0);
  });

  it("opens the lane for the example itself, which is what pays for it", () => {
    expect(laned(render(RETHINK, { width: 80 }))).toBe(true);
  });
});

describe("edges converging on one node, the last one not sent round the box", () => {
  const source =
    "graph TD\n    A[Source] --> H[Hub]\n    B[Autre] -->|oui| H\n    C[Tiers] -.->|non| H\n" +
    "    D[Quatre] ==> H\n    H --> E[Sortie]\n    H -->|peut etre| F[Erreur]\n";

  it.each(TWO_PANES)("lands every head on the target's border at width %i", (width) => {
    const drawn = render(source, { width });
    const heads = drawn.split("\n").filter((row) => row.includes("⏷"));
    const fan = heads.find((row) => (row.match(/⏷/gu) ?? []).length === 4);
    expect(fan).toBeDefined();
    expect(drawn.split("\n")[drawn.split("\n").indexOf(must(fan)) + 1]).toContain("┌");
  });

  it.each(TWO_PANES)("keeps the thick edge thick all the way in, at width %i", (width) => {
    const drawn = render(source, { width });
    expect(drawn).toContain("━");
    expect(drawn.split("\n").filter((row) => row.includes("┃")).length).toBeGreaterThan(1);
  });

  it.each(TWO_PANES)("turns the thick edge on a HEAVY corner and the others on rounded ones, at width %i", (width) => {
    const drawn = render(source, { width });
    expect(drawn).toMatch(/[┏┓┗┛]/u);
    for (const round of [..."╭╮╰╯"]) {
      for (const row of drawn.split("\n")) {
        const at = row.indexOf(round);
        if (at < 0) continue;
        expect(`${row[at - 1] ?? " "}${row[at + 1] ?? " "}`).not.toMatch(/━/u);
      }
    }
    expect(drawn).toMatch(/[╭╮╰╯]/u);
  });

  it.each(TWO_PANES)("gives each of the four a run of its own, at width %i", (width) => {
    const rows = render(source, { width }).split("\n");
    const band = rows.filter((row) => !/[┌┐└┘]/u.test(row));
    for (const row of band) {
      for (const run of row.match(/[─┄━]+/gu) ?? []) expect(new Set([...run]).size).toBe(1);
    }
  });

  it.each(TWO_PANES)("never runs an edge along the target's own top border at width %i", (width) => {
    const rows = render(source, { width }).split("\n");
    const top = rows.findIndex((row) => row.includes("Hub")) - 2;
    expect(rows[top]).toMatch(/^\s*┌[─]+┐\s*$/u);
  });
});

describe("a corner and a line in one cell, which draws a tee where nothing joins", () => {
  const source = "flowchart TD\n    A[a] --> X[x]\n    A --> Y[y]\n    B[b] --> X\n    B --> Y\n" +
    "    C[c] --> X\n    C --> Z[z]\n    B --> Z\n";

  const band = (drawn: string): string[] => {
    const rows = drawn.split("\n");
    const leaves = rows.findIndex((row) => row.includes("└"));
    const lands = rows.findIndex((row) => row.includes("⏷"));
    expect(leaves).toBeGreaterThan(0);
    expect(lands).toBeGreaterThan(leaves);
    return rows.slice(leaves + 1, lands);
  };

  it.each(TWO_PANES)("draws no junction in the band, where nothing joins anything, at width %i", (width) => {
    for (const row of band(render(source, { width }))) expect(row).not.toMatch(/[┴┬├┤┼]/u);
  });


  it("cuts a HOLE in a border a run goes through, the frame stopping either side of the cable and never joining it", () => {
    const drawn = render("flowchart TD\n    A[entree] --> B\n    subgraph moteur\n        B[parse] --> C[rendu]\n" +
      "    end\n    C --> D[sortie]\n", { width: 80 });
    expect(drawn).not.toContain("┼");
    expect(drawn.split("\n").filter((row) => /─│─/u.test(row))).toHaveLength(2);
  });
});

describe("a self loop and an edge out of the same node, two lines and never one", () => {
  const source = "flowchart LR\n    A[etat] --> A\n    A --> B[suivant]\n";
  const HOME = "⏴";
  const AWAY = "⏵";

  it.each(TWO_PANES)("gives each of them a row of its own, at width %i", (width) => {
    const rows = render(source, { width }).split("\n");
    expect(rows.filter((row) => row.includes(HOME))).toHaveLength(1);
    expect(rows.filter((row) => row.includes(AWAY))).toHaveLength(1);
    expect(rows.some((row) => row.includes(HOME) && row.includes(AWAY))).toBe(false);
  });

  it.each(TWO_PANES)("leaves the loop its corner and the line between, at width %i", (width) => {
    expect(render(source, { width })).toContain("⏴─╯");
  });
});

describe("a self-loop's return seated apart from a departure, at every width", () => {
  const both = "flowchart\n    A[etat] --> A\n    A --> B[suivant]\n";

  it.each([10, 13, 15, 25, 40])("draws the loop WHOLE at width %i, head against the border and its corner behind it", (width) => {
    const drawn = render(both, { width });
    expect(drawn).toMatch(/│⏴─?╯|│⏴─?─╯/u);
  });

  it.each([10, 13, 15, 20, 22, 25, 26, 27, 40])("keeps the loop's head off the departure at width %i", (width) => {
    const drawn = render(both, { width });
    expect(drawn).toContain("⏴");
    expect(drawn).toMatch(/[⏵⏷]/u);
    expect(drawn).not.toContain("⏴⏵");
  });
});

describe("two edges never lying down on one line, which the seats braided into `┴───┴`", () => {
  const heads = (drawn: string): number => (drawn.match(/[⏵⏴⏶⏷]/gu) ?? []).length;
  const k22 = "flowchart LR\n    C[App Server 1] --> E[(PostgreSQL)]\n    D[App Server 2] --> E\n" +
    "    C --> F[(Redis)]\n    D --> F\n";

  it("gives each of the four edges its own head and its own line, at the default", () => {
    const drawn = render(k22);
    expect(heads(drawn)).toBe(4);
    expect(drawn).not.toContain("┴");
    expect(drawn).not.toContain("┬");
  });

  it.each([40, 60, 80, 200])("keeps them apart at width %i", (width) => {
    const drawn = render(k22, { width });
    expect(heads(drawn)).toBe(4);
    expect(drawn).not.toContain("┴");
  });

  it("unbraids the corpus drawing it was measured on, subgraphs around every layer", () => {
    const gros = "graph\n    subgraph Client\n        A[Browser]\n    end\n    subgraph Server\n" +
      "        B[Load Balancer]\n        C[App Server 1]\n        D[App Server 2]\n    end\n" +
      "    subgraph Data\n        E[(PostgreSQL)]\n        F[(Redis)]\n    end\n" +
      "    A --> B\n    B --> C\n    B --> D\n    C --> E\n    D --> E\n    C --> F\n    D --> F\n";
    for (const options of [{}, { width: 80 }]) {
      const drawn = render(gros, options);
      expect(heads(drawn)).toBe(7);
      expect(drawn).not.toContain("┴");
    }
  });

  it("leaves a trunk a trunk: edges sharing a node still share its cells on purpose", () => {
    const drawn = render("flowchart TD\n    A[entree] --> B[premiere etape]\n    A --> C[voie de cote]\n");
    const border = drawn.split("\n").find((row) => row.includes("└")) ?? "";
    expect((border.match(/┬/gu) ?? []).length).toBe(2);
  });
});
