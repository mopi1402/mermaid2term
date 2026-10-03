import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { widest } from "../support/drawn.js";

describe("a flowchart naming no direction drawn ACROSS, which mermaid takes down the page", () => {
  const chain = "    A[Ingest] --> B[Validate]\n    B --> C[Transform]\n    C --> D[Store]\n";
  const DOWN = "⏷";
  const transposed = (drawn: string): boolean => {
    const rows = drawn.split("\n");
    return rows.findIndex((row) => row.includes("Ingest")) !== rows.findIndex((row) => row.includes("Validate"));
  };

  it("runs ACROSS where the header names nothing and the budget holds it", () => {
    const drawn = render(`flowchart\n${chain}`, { width: 80 });
    expect(drawn).not.toContain(DOWN);
    expect(widest(drawn)).toBeLessThanOrEqual(80);
  });

  it("keeps it across however TIGHT the ladder had to compact it, a chain being 5 rows either way", () => {
    for (const width of [67, 60, 50, 45, 42]) {
      const drawn = render(`flowchart\n${chain}`, { width });
      expect(drawn, `budget ${width}`).not.toContain(DOWN);
      expect(widest(drawn), `budget ${width}`).toBeLessThanOrEqual(width);
    }
  });

  it("takes the SHORTER of the two where the budget holds both, and not the one that reads left to right", () => {
    const fan =
      "flowchart\n    A[a] --> X[x]\n    A --> Y[y]\n    B[b] --> X\n    B --> Y\n    C[c] --> X\n" +
      "    C --> Z[z]\n    B --> Z\n";
    const drawn = render(fan, { width: 80 });
    expect(drawn).toContain(DOWN);
    expect(drawn.split("\n").length).toBeLessThan(render(`flowchart LR\n${fan.split("\n").slice(1).join("\n")}`, { width: 80 }).split("\n").length);
  });

  it("measures ROWS and never CELLS, a column left blank to the right costing nothing to read", () => {
    const arrows = "    A --> B\n    B --- C\n    C -.-> D\n    D ==> E\n";
    const rows = (drawn: string): number => drawn.split("\n").length;
    const area = (drawn: string): number => rows(drawn) * widest(drawn);

    const chosen = render(`flowchart\n${arrows}`, { width: 80 });
    const down = render(`flowchart TD\n${arrows}`, { width: 80 });
    expect(chosen).not.toContain(DOWN);
    expect(rows(chosen)).toBe(5);
    expect(area(down)).toBeLessThan(area(chosen));
  });

  it("WRAPS the drawing across before it turns it, once the tightest one cannot fit", () => {
    const wrapped = render(`flowchart\n${chain}`, { width: 41 });
    expect(transposed(wrapped)).toBe(false);
    expect(widest(wrapped)).toBeLessThanOrEqual(41);
    expect(wrapped.split("\n").length).toBeGreaterThan(5);
  });

  it("turns it once even the narrowest fold cannot hold the budget", () => {
    expect(transposed(render(`flowchart\n${chain}`, { width: 20 }))).toBe(true);
  });

  it("switches ONCE as the budget grows, and never back", () => {
    const turned: boolean[] = [];
    for (let width = 20; width <= 80; width += 1) turned.push(transposed(render(`flowchart\n${chain}`, { width })));
    expect(turned[0]).toBe(true);
    expect(turned[turned.length - 1]).toBe(false);
    expect(turned.slice(1).filter((down, at) => down !== turned[at]).length).toBe(1);
  });

  it("never turns a direction that WAS written, in either direction", () => {
    expect(transposed(render(`flowchart LR\n${chain}`, { width: 20 }))).toBe(false);
    expect(render(`flowchart TD\n${chain}`, { width: 200 })).toContain(DOWN);
    expect(render(`graph TB\n${chain}`, { width: 200 })).toContain(DOWN);
  });

  it("leaves the drawing across in place when the rotation is held still, budget or no budget", () => {
    const held = render(`flowchart\n${chain}`, { width: 20, autoRotate: false });
    expect(transposed(held)).toBe(false);
    expect(widest(held)).toBeGreaterThan(20);
  });

  it("starts a STATE diagram across too, which shares this engine and a terminal's shape", () => {
    const states = "stateDiagram-v2\n    [*] --> Idle\n    Idle --> Busy\n    Busy --> Idle\n";
    expect(render(states, { width: 200 })).not.toContain(DOWN);
    const told = "stateDiagram-v2\n    direction TB\n    [*] --> Idle\n    Idle --> Busy\n";
    expect(render(told, { width: 200 })).toContain(DOWN);
  });
});

describe("a name turned over with the drawing and not REWRITTEN, which `BT` spelt wrong", () => {
  const up = (label: string): string =>
    render(`flowchart BT\n    A[${label}] --> B[suite]\n`, { width: 60 });

  it.each(["Divided", "avant", "chevron ^", "et/ou", "anti\\slash"])("keeps `%s` as it was written", (label) => {
    expect(up(label)).toContain(label);
  });

  it("still turns the GEOMETRY over, which is the whole point of the pass", () => {
    const rows = up("Divided").split("\n");
    expect(rows.findIndex((row) => row.includes("suite"))).toBeLessThan(
      rows.findIndex((row) => row.includes("Divided"))
    );
    expect(rows.join("\n")).toContain("⏶");
    expect(rows.join("\n")).not.toContain("⏷");
  });

  it("leaves the same names alone through the horizontal flip, which never had the fault", () => {
    for (const label of ["Divided", "et/ou"]) {
      expect(render(`flowchart RL\n    A[${label}] --> B[suite]\n`, { width: 60 })).toContain(label);
    }
  });
});

describe("a graph turned right to left mirrors its GEOMETRY and moves its TEXT, spelt forwards", () => {
  const fan =
    "flowchart RL\n    A[dispatch] --> B[un]\n    A --> C[deux]\n    A --> D[trois]\n    B --> E[fin]\n    C --> E\n    D --> E\n";

  it("keeps every node label readable", () => {
    const drawn = render(fan, { width: 80 });
    for (const label of ["dispatch", "un", "deux", "trois", "fin"]) expect(drawn).toContain(label);
    expect(drawn).not.toContain("hctapsid");
    expect(drawn).not.toContain("nif");
  });

  it("keeps an edge label, a wide glyph and a label's own angle bracket as written", () => {
    const drawn = render("flowchart RL\n    A[debut 🎉] -->|va vers| B[a < b]\n    B --> C[fin]\n", { width: 60 });
    expect(drawn).toContain("debut 🎉");
    expect(drawn).toContain("va vers");
    expect(drawn).toContain("a < b");
    expect(drawn).not.toContain("a > b");
  });

  it("still mirrors the drawing itself, the flow arriving from the right", () => {
    const drawn = render(fan, { width: 80 });
    expect(drawn).toContain("⏴");
    expect(drawn).not.toContain("⏵");
  });
});

describe("a flipped drawing sits at the top left like any other, its margin staying at the bottom right", () => {
  const fanBT =
    "flowchart BT\n    A[a] --> X[x]\n    A --> Y[y]\n    B[b] --> X\n    B --> Y\n    C[c] --> X\n    C --> Z[z]\n    B --> Z\n";

  it("opens a BT drawing on its first drawn line, nothing blank before or after", () => {
    const drawn = render(fanBT, { width: 80 });
    expect(drawn.startsWith("\n")).toBe(false);
    expect(drawn.endsWith("\n")).toBe(false);
    expect(drawn.split("\n")[0]).toMatch(/\S/u);
  });

  it("starts an RL drawing at the first column, no gutter of spaces down its side", () => {
    const drawn = render("flowchart RL\n    A[dispatch] --> B[un]\n    B --> C[fin]\n", { width: 80 });
    const lines = drawn.split("\n").filter((line) => line.length > 0);
    expect(Math.min(...lines.map((line) => line.search(/\S/u)))).toBe(0);
  });
});

describe("a drawing turned upside down keeps each label's lines in reading order", () => {
  it("draws a two-line label top line first in BT", () => {
    const drawn = render("flowchart BT\n    A[first line<br>second line] --> B", { width: 80 });
    const rows = drawn.split("\n");
    const first = rows.findIndex((row) => row.includes("first line"));
    const second = rows.findIndex((row) => row.includes("second line"));
    expect(first).toBeGreaterThan(-1);
    expect(second).toBe(first + 1);
  });
});
