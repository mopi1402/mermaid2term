import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { type BorderMode } from "../../src/options.js";
import { gridOf } from "../support/grid.js";

const THEME = "dracula";
const STROKE = "9900ff";
const BOX_DRAWING = /^[─-▟]$/u;

const SOURCE = (direction: string, fill: string): string => `erDiagram
    direction ${direction}
    subgraph rental
        AGENCY ||--o{ DRIVER : allows
    end
    ${fill}
    classDef hired stroke:#${STROKE}
    class DRIVER hired`;

// The grounds under an entity's outline, told apart by whether its class inks it.
function outlineGrounds(source: string, borders: BorderMode, inked: boolean): string[] {
  const cells = gridOf(renderThemedText(source, { width: 100, borders }, THEME))
    .flat()
    .filter((cell) => cell.owner.startsWith("node") && BOX_DRAWING.test(cell.ch) && cell.owner.includes(STROKE) === inked);
  return [...new Set(cells.map((cell) => cell.ground))].sort();
}

describe("an entity whose outline is inked by its class stands where an uninked one does, inside a group", () => {
  for (const [what, fill] of [["the theme's fill", ""], ["a fill of its own", "classDef default fill:#f9f"]]) {
    for (const direction of ["TB", "LR"]) {
      for (const borders of ["default", "padless"] satisfies BorderMode[]) {
        it(`${what}, ${direction}, ${borders}`, () => {
          const plain = outlineGrounds(SOURCE(direction, fill), borders, false);
          expect(plain.length).toBeGreaterThan(0);
          expect(outlineGrounds(SOURCE(direction, fill), borders, true)).toEqual(plain);
        });
      }
    }
  }
});
