import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { must } from "../../src/must.js";
import { THREE_PANES } from "../support/drawn.js";

const SOURCE = (direction: string, line: string): string =>
  `classDiagram\n    direction ${direction}\n    class OrderService {\n        +place(Order one)\n        +cancel(int id)\n    }\n    class Warehouse {\n        +reserve(int sku)\n    }\n    Ordering ()${line} OrderService\n    OrderService ${line}() Billing\n    Warehouse ${line}() Billing\n    OrderService "1" --> "1..*" Warehouse\n`;

const ALONG_ROW = new Set(["─", "┄", "╭", "╮", "╰", "╯"]);
const ALONG_COLUMN = new Set(["│", "┆", "┊", "╭", "╮", "╰", "╯"]);

// Every ring the drawing holds, with the cells on either side of it along the row and along the column.
const rings = (drawing: string): Array<{ across: string[]; down: string[] }> => {
  const rows = drawing.split("\n").map((row) => [...row]);
  return rows.flatMap((row, r) =>
    row.flatMap((ch, c) =>
      ch === "○" ? [{ across: [row[c - 1] ?? " ", row[c + 1] ?? " "], down: [rows[r - 1]?.[c] ?? " ", rows[r + 1]?.[c] ?? " "] }] : []
    )
  );
};

describe("a lollipop's ring stands ON its run, the run touching it", () => {
  it.each([
    ["LR", ALONG_ROW, "across"],
    ["TB", ALONG_COLUMN, "down"],
  ] as const)("every ring is met by its line, direction %s", (direction, strokes, side) => {
    for (const line of ["--", ".."]) {
      for (const borders of ["default", "padless", "borderless"] as const) {
        for (const width of THREE_PANES) {
          const drawing = render(SOURCE(direction, line), { width, borders });
          const found = rings(drawing);
          expect(found).toHaveLength(3);
          for (const ring of found) expect(ring[side].some((ch) => strokes.has(ch)), drawing).toBe(true);
        }
      }
    }
  });

  it("names the ring on the row over it when the run comes along the row", () => {
    const rows = render(SOURCE("LR", "--"), { width: 120 }).split("\n");
    const at = must(rows.findIndex((row) => row.includes("○─")));
    expect(rows[at - 1]).toContain("Ordering");
  });
});
