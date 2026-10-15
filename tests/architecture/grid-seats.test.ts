import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { gridOf, type Cell } from "../support/grid.js";
import { displayWidth } from "../../src/text/width.js";
import { TWO_PANES } from "../support/drawn.js";

const FRAME = "subgraph";

interface Spot {
  readonly row: number;
  readonly centre: number;
}

interface Frame {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

function spotOf(lines: readonly string[], label: string): Spot {
  const row = lines.findIndex((line) => new RegExp(String.raw`\b${label}\b`, "u").test(line));
  expect(row, label).toBeGreaterThanOrEqual(0);
  const col = displayWidth(lines[row].slice(0, lines[row].search(new RegExp(String.raw`\b${label}\b`, "u"))));
  return { row, centre: col + label.length / 2 };
}

function frameOf(grid: readonly Cell[][]): Frame {
  const rows: number[] = [];
  const cols: number[] = [];
  grid.forEach((cells, row) =>
    cells.forEach((cell, col) => {
      if (cell.owner !== FRAME) return;
      rows.push(row);
      cols.push(col);
    })
  );
  return { top: Math.min(...rows), bottom: Math.max(...rows), left: Math.min(...cols), right: Math.max(...cols) };
}

const inside = (spot: Spot, frame: Frame): boolean =>
  spot.row > frame.top && spot.row < frame.bottom && spot.centre > frame.left && spot.centre < frame.right;

function drawnFrom(width: number, body: readonly string[], labels: readonly string[]): { spots: Record<string, Spot>; frame: Frame } {
  const out = renderThemedText(["architecture-beta", ...body.map((line) => `    ${line}`)].join("\n"), { width }, "default");
  const lines = out.plain.split("\n");
  const spots = Object.fromEntries(labels.map((label) => [label, spotOf(lines, label)]));
  return { spots, frame: frameOf(gridOf(out)) };
}

const drawn = (width: number, last: string): { spots: Record<string, Spot>; frame: Frame } =>
  drawnFrom(
    width,
    [
      "group api(cloud)[API]",
      "service my-api(server)[MyAPI] in api",
      "service db(database)[Base] in api",
      "service x(disk)[Store] in api",
      "service web(internet)[Web]",
      "web:R -[calls]-> L:my-api",
      "my-api:B --> T:db",
      last,
    ],
    ["Web", "MyAPI", "Base", "Store"]
  );

const sameRow = (a: Spot, b: Spot): boolean => a.row === b.row;
const sameColumn = (a: Spot, b: Spot): boolean => Math.abs(a.centre - b.centre) <= 1;

describe("architecture services sit on the cell their edge sides imply, as mermaid 12's fcose seats them (2026-09-29)", () => {
  for (const width of TWO_PANES) {
    it(`a column down the group stays under the service it hangs from, the outsider out of the frame, at ${width}`, () => {
      const { spots, frame } = drawn(width, "db:B --> T:x");
      const { Web, MyAPI, Base, Store } = spots;
      expect(sameRow(Web, MyAPI) && Web.centre < MyAPI.centre).toBe(true);
      expect(sameColumn(Base, MyAPI) && Base.row > MyAPI.row).toBe(true);
      expect(sameColumn(Store, Base) && Store.row > Base.row).toBe(true);
      expect(inside(Web, frame)).toBe(false);
      for (const member of [MyAPI, Base, Store]) expect(inside(member, frame)).toBe(true);
    });

    it(`a service right of a lower one stays on that one's row, at ${width}`, () => {
      const { spots, frame } = drawn(width, "db:R --> L:x");
      const { Web, MyAPI, Base, Store } = spots;
      expect(sameRow(Web, MyAPI) && Web.centre < MyAPI.centre).toBe(true);
      expect(sameColumn(Base, MyAPI) && Base.row > MyAPI.row).toBe(true);
      expect(sameRow(Store, Base) && Store.centre > Base.centre).toBe(true);
      expect(inside(Web, frame)).toBe(false);
      for (const member of [MyAPI, Base, Store]) expect(inside(member, frame)).toBe(true);
    });

    it(`a service below a member, the group spanning its column, steps down out of the frame, at ${width}`, () => {
      const { spots, frame } = drawnFrom(
        width,
        ["group g(cloud)[G]", "service a(server)[Aa] in g", "service c(server)[Cc] in g", "service d(server)[Dd] in g", "service b(server)[Bb]", "a:R --> L:c", "c:B --> T:d", "a:B --> T:b"],
        ["Aa", "Bb", "Cc", "Dd"]
      );
      const { Aa, Bb, Cc, Dd } = spots;
      expect(sameColumn(Bb, Aa) && Bb.row > Dd.row).toBe(true);
      expect(inside(Bb, frame)).toBe(false);
      for (const member of [Aa, Cc, Dd]) expect(inside(member, frame)).toBe(true);
    });

    it(`a service seated between two members of one row steps across out of the frame, at ${width}`, () => {
      const { spots, frame } = drawnFrom(
        width,
        ["group g(cloud)[G]", "service a(server)[Aa] in g", "service c(server)[Cc] in g", "service b(server)[Bb]", "a:R --> L:b", "b:R --> L:c"],
        ["Aa", "Bb", "Cc"]
      );
      const { Aa, Bb, Cc } = spots;
      expect(sameRow(Aa, Cc) && Aa.centre < Bb.centre && Bb.centre < Cc.centre).toBe(true);
      expect(inside(Bb, frame)).toBe(false);
      for (const member of [Aa, Cc]) expect(inside(member, frame)).toBe(true);
    });

    it(`an aligned row keeps its row past a cell another service holds, at ${width}`, () => {
      const { spots } = drawnFrom(
        width,
        ["service a(server)[Aa]", "service b(server)[Bb]", "service c(server)[Cc]", "service d(server)[Dd]", "a:R --> L:b", "b:B --> T:c", "align row a d"],
        ["Aa", "Bb", "Cc", "Dd"]
      );
      const { Aa, Dd } = spots;
      expect(sameRow(Aa, Dd) && Aa.centre < Dd.centre).toBe(true);
    });
  }
});
