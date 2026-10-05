import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { runsOf, stripSgr, type Run } from "../support/ansi.js";

// mermaid's `.cluster rect` fills an ER subgraph with `clusterBkg`, #FFFFDE on `default`.
const CLUSTER = "48;2;255;255;222";
const RED = "38;2;255;0;0";

const er = (direction: string): string =>
  `erDiagram\n  direction ${direction}\n  USER ||--o{ ORDER : places\n  subgraph Shop\n    ORDER ||--|{ LINE : has\n  end\n  style Shop stroke:#f00\n`;

const drawn = (direction: string, borders: "default" | "padless"): string[] =>
  renderThemed(er(direction), { width: 120, background: "light", borders }, "default").split("\n");

const wallRow = (lines: readonly string[], wall: string): Run[] =>
  runsOf(lines.find((line) => line.includes("Shop")) ?? "").filter(([, text]) => text === wall);

describe("an ER subgraph on mermaid's cluster ground", () => {
  it.each(["TB", "LR"])("lays clusterBkg inside the frame and keeps the whole-glyph wall off it (%s)", (direction) => {
    const lines = drawn(direction, "default");
    const title = runsOf(must(lines.find((line) => line.includes("Shop"))));
    expect(title.some(([codes, text]) => text.includes("Shop") && codes.includes(CLUSTER))).toBe(true);
    // The two walls, the run entering from above crossing the title row between them in its own ink.
    const walls = wallRow(lines, "│");
    for (const [codes] of [walls[0], walls.at(-1)].map((run) => must(run))) {
      expect(codes).toContain(RED);
      expect(codes).not.toContain(CLUSTER);
    }
  });

  it.each(["TB", "LR"])("padless moves the walls onto the cell edge, the ground meeting them in the stroke's ink (%s)", (direction) => {
    const lines = drawn(direction, "padless");
    const walls = [...wallRow(lines, "▏"), ...wallRow(lines, "▕")];
    expect(walls).toHaveLength(2);
    for (const [codes] of walls) {
      expect(codes).toContain(RED);
      expect(codes).toContain(CLUSTER);
    }
  });
});


describe("a dashed ER subgraph inside another", () => {
  const nested = (direction: string): string =>
    `erDiagram\n  direction ${direction}\n  subgraph outer\n    A ||--o{ B : has\n    subgraph inner\n      C\n    end\n  end\n  style inner stroke-dasharray: 5 5\n`;

  it.each([
    ["TB", "default"],
    ["LR", "default"],
    ["TB", "padless"],
    ["LR", "padless"],
  ] as const)("keeps the outer ground in the gaps of its dashed rule (%s, %s)", (direction, borders) => {
    const lines = renderThemed(nested(direction), { width: 120, background: "light", borders }, "default").split("\n");
    const dashed = lines.filter((line) => /[─▁▔] [─▁▔]/u.test(stripSgr(line)));
    expect(dashed.length).toBeGreaterThan(0);
    for (const line of dashed) {
      for (const [codes, text] of runsOf(line)) if (/^ +$/u.test(text) && /[─▁▔]/u.test(line)) expect(codes).toContain(CLUSTER);
    }
  });
});
