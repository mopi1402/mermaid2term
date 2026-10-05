import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";
import { must } from "../../src/must.js";
import { type BorderMode } from "../../src/options.js";
import { gridOf, type Cell } from "../support/grid.js";

const plain = (source: string, borders: BorderMode): string => render(source, { width: 80, borders });
const themed = (source: string): Cell[][] => gridOf(renderThemedText(source, { width: 80, borders: "borderless" }, "dracula"));
const glyphs = (row: readonly Cell[]): string => row.map(({ ch }) => ch).join("");
const BOX_CORNERS = /[┌┐└┘]/u;

const CLASSES = (direction: string): string =>
  `classDiagram\n  direction ${direction}\n  namespace Shapes {\n    class Circle {\n      +radius int\n    }\n    class Square\n  }\n  Circle <|-- Dot\n  Square --> Dot\n`;
const ENTITIES = (direction: string): string =>
  `erDiagram\n  direction ${direction}\n  subgraph Shop\n    ORDER ||--|{ LINE : has\n  end\n  USER ||--o{ ORDER : places\n`;

describe("a class diagram and an ER diagram follow borderless as the flowchart does", () => {
  it.each([
    ["class", "TB", CLASSES],
    ["class", "LR", CLASSES],
    ["ER", "TB", ENTITIES],
    ["ER", "LR", ENTITIES],
  ])("lays every %s box and the outermost frame as slabs of their ground, direction %s", (_, direction, source) => {
    const grid = themed(source(direction));
    const drawing = grid.map(glyphs).join("\n");
    expect(drawing).not.toMatch(BOX_CORNERS);
    expect(drawing).toMatch(/▗▄+▖/u);
    expect(drawing).toMatch(/▝▀+▘/u);
    for (const word of ["Dot", "Circle", "USER", "ORDER"]) {
      const at = grid.findIndex((cells) => glyphs(cells).includes(` ${word} `));
      if (at === -1) continue;
      const col = glyphs(grid[at]).indexOf(` ${word} `) + 1;
      expect([...glyphs(grid[at - 1])][col]).toBe("▄");
    }
  });

  it.each(["TB", "LR"])("keeps every outline where no theme lays a ground, direction %s", (direction) => {
    expect(plain(CLASSES(direction), "borderless")).toBe(plain(CLASSES(direction), "default"));
    expect(plain(ENTITIES(direction), "borderless")).toBe(plain(ENTITIES(direction), "default"));
  });

  it("lays a class note as a slab even with no theme, as a flowchart note is", () => {
    const source = `${CLASSES("TB")}  note for Dot "a note"\n`;
    const note = must(plain(source, "borderless").split("\n").find((row) => row.includes("a note")));
    expect(note).toMatch(/▐ a note\s+▌/u);
  });
});
