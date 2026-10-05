import { describe, expect, it } from "vitest";
import { UNICODE } from "../../src/canvas/charsets.js";
import { type CharSet } from "../../src/canvas/model.js";
import { parseClassDiagram } from "../../src/diagrams/classdiagram/parser.js";
import { renderClassDiagram } from "../../src/diagrams/classdiagram/render.js";

describe("`hideEmptyMembersBox` passed to the renderer, an argument and not a mark left on the diagram", () => {
  it("draws the two empty compartments again when the flag is dropped between two renders of one parse", () => {
    const diagram = parseClassDiagram("classDiagram\n  class Duck\n");
    expect(renderClassDiagram(diagram, UNICODE, 2, 4, true, true).toString()).not.toMatch(/│\s+Duck\s+│\n\s*├─+┤/u);
    expect(renderClassDiagram(diagram, UNICODE, 2, 4, true, false).toString()).toMatch(/│\s+Duck\s+│\n\s*├─+┤/u);
  });
});

describe("a relationship's label chip sits on the shaft, whatever glyph the charset draws the shaft with", () => {
  const BARS: CharSet = { ...UNICODE, name: "bars", lineVertical: "|", lineDottedV: ":" };
  const placeOf = (drawn: string, text: string): [number, number] => {
    const row = drawn.split("\n").findIndex((line) => line.includes(text));
    return [row, drawn.split("\n")[row].indexOf(text)];
  };

  it.each(["TD", "LR"])("puts the chip where the unicode drawing puts it, direction %s", (direction) => {
    for (const source of [`classDiagram\n  direction ${direction}\n  Animal <|-- Duck : eats\n`, `classDiagram\n  direction ${direction}\n  Animal ..> Duck : eats\n`]) {
      const unicode = renderClassDiagram(parseClassDiagram(source), UNICODE).toString();
      const bars = renderClassDiagram(parseClassDiagram(source), BARS).toString();
      expect(placeOf(bars, "eats")).toEqual(placeOf(unicode, "eats"));
    }
  });

  it("centres the chip on the bar it cuts, the bar continuing above and below it", () => {
    const drawn = renderClassDiagram(parseClassDiagram("classDiagram\n  direction TD\n  Animal <|-- Duck : eats\n"), BARS).toString();
    const [row, col] = placeOf(drawn, "eats");
    const lines = drawn.split("\n");
    const shaft = col + Math.floor("eats".length / 2);
    expect(lines[row - 1][shaft]).toBe("|");
    expect(lines[row + 1][shaft]).toBe("|");
  });
});
