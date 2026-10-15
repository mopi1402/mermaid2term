import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { gridOf, type Cell } from "../support/grid.js";
import { TWO_PANES } from "../support/drawn.js";

const LABEL_OWNER = "edge_label";
const WALL_OWNERS = ["subgraph", "node"] as const;
const WALL = /[│┃╹╻┆┇╎╏]/u;
const RULE = /[─━┄┅╌╍]/u;

const walled = (cell: Cell | undefined, glyph: RegExp): boolean =>
  cell !== undefined && glyph.test(cell.ch) && WALL_OWNERS.some((owner) => cell.owner === owner || cell.owner.startsWith(`${owner}@`));

// A label cell under or over a wall's stroke, or between two cells of one rule, was written over that wall.
function coveredWalls(grid: readonly Cell[][]): string[] {
  const covered: string[] = [];
  grid.forEach((cells, row) =>
    cells.forEach((cell, col) => {
      if (!cell.owner.startsWith(LABEL_OWNER)) return;
      const up = grid[row - 1]?.[col];
      const down = grid[row + 1]?.[col];
      if (walled(up, WALL) || walled(down, WALL)) covered.push(`${row}:${col} ${cell.ch}`);
      if (walled(cells[col - 1], RULE) && walled(cells[col + 1], RULE)) covered.push(`${row}:${col} ${cell.ch}`);
    })
  );
  return covered;
}

const drawnAs = (header: string, width: number, body: readonly string[]): { plain: string; covered: string[] } => {
  const out = renderThemedText([header, ...body.map((line) => `    ${line}`)].join("\n"), { width }, "default");
  return { plain: out.plain, covered: coveredWalls(gridOf(out)) };
};

const CASES: ReadonlyArray<readonly [string, string, readonly string[]]> = [
  [
    "a run entering a group",
    "calls",
    ["group api(cloud)[API]", "service my-api(server)[My API] in api", "service db(database)[DB] in api", "service web(internet)", "web:R -[calls]-> L:my-api", "my-api:B-->T:db"],
  ],
  [
    "a run entering a group laid down its column",
    "calls",
    ["group api(cloud)[API]", "service my-api(server)[MyAPI] in api", "service db(database)[DB] in api", "service x(disk)[X] in api", "service web(internet)[Web]", "web:R -[calls]-> L:my-api", "my-api:B --> T:db", "db:B --> T:x"],
  ],
  ["a run leaving a group", "responds", ["group g(cloud)[G]", "service a(server)[A] in g", "service b(database)[B]", "a:R -[responds]-> L:b"]],
  [
    "a label longer than the gap",
    "a label longer than the gap",
    ["group api(cloud)[API]", "service my-api(server)[My API] in api", "service web(internet)", "web:R -[a label longer than the gap]-> L:my-api"],
  ],
  [
    "a run between two groups and one down inside the second",
    "fan out",
    ["group g1(cloud)[One]", "group g2(cloud)[Two]", "service a(server)[A] in g1", "service b(server)[B] in g2", "service c(server)[C] in g2", "a:R -[sync]-> L:b", "b:B -[fan out]-> T:c"],
  ],
  [
    "runs down into and out of a group",
    "writes to",
    ["group g(cloud)[G]", "service w(internet)", "service a(server)[A] in g", "service b(database)[B]", "w:B -[calls]-> T:a", "a:B -[writes to]-> T:b"],
  ],
];

describe("an architecture edge label never covers a group's wall or a box's border (2026-09-29)", () => {
  for (const width of TWO_PANES) {
    describe(`at width ${width}`, () => {
      for (const [name, label, body] of CASES) {
        it(`keeps every wall whole beside ${name}`, () => {
          const { plain, covered } = drawnAs("architecture-beta", width, body);
          expect(plain).toContain(label);
          expect(covered).toEqual([]);
        });
      }
    });
  }
});

describe("a flowchart edge label entering a subgraph keeps its wall whole, the gap shared with architecture (2026-09-29)", () => {
  for (const width of TWO_PANES) {
    it(`at width ${width}`, () => {
      const { plain, covered } = drawnAs("flowchart LR", width, ["subgraph Two", "  b -->|fan out long| c", "end", "a -->|sync| b"]);
      expect(plain).toContain("sync");
      expect(covered).toEqual([]);
    });
  }
});
