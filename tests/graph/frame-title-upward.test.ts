import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { THREE_PANES } from "../support/drawn.js";

const rowsOf = (drawing: string): string[][] => drawing.split("\n").map((row) => [...row]);

describe("a class namespace laid out upward keeps its lid on top", () => {
  it.each(["TB", "BT"])("the classes sit one row above the floor, direction %s", (direction) => {
    const source = `classDiagram\n  direction ${direction}\n  namespace Shapes {\n    class Circle\n    class Square\n  }\n  Circle <|-- Dot\n  Square <|-- Tile\n`;
    for (const width of THREE_PANES) {
      const rows = rowsOf(render(source, { width }));
      const title = rows.findIndex((row) => row.join("").includes(" Shapes "));
      const left = rows[title].indexOf("│");
      const floor = title + rows.slice(title).findIndex((row) => row[left] === "└");
      expect(rows[title - 1][left]).toBe("┌");
      expect(rows[floor - 2].join("")).toContain("└");
    }
  });
});

describe("an ER group's title steps aside from the line crossing it", () => {
  it.each([
    ["TB", "DOT ||--|| CIRCLE : has"],
    ["BT", "CIRCLE ||--|| DOT : has"],
  ])("the stem runs unbroken through the title row, direction %s", (direction, rel) => {
    const source = `erDiagram\n  direction ${direction}\n  subgraph Shapes\n    CIRCLE\n  end\n  ${rel}\n`;
    for (const width of THREE_PANES) {
      const rows = rowsOf(render(source, { width }));
      const title = rows.findIndex((row) => row.join("").includes("Shapes"));
      const stem = rows[title - 1].indexOf("│");
      expect(stem).toBeGreaterThan(0);
      expect(rows[title][stem]).toBe("│");
    }
  });
});
