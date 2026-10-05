import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { gridOf } from "../support/grid.js";

const SOURCE = (direction: string): string => `---
config:
  theme: base
  themeVariables:
    mainBkg: "#f4ecff"
    nodeBorder: "#7048e8"
---
classDiagram
    direction ${direction}
    class Invoice {
        +issue()
    }
    class Money
    Invoice --> Money`;

describe("a variable the source writes is kept as written, the theme turned for the other ground around it", () => {
  for (const direction of ["TB", "LR"]) {
    for (const background of ["dark", "light"] as const) {
      it(`${direction}, on a ${background} ground`, () => {
        const text = renderThemedText(SOURCE(direction), { width: 80, background }, "base");
        const cells = gridOf(text).flat();
        const named = cells.filter((cell) => /[A-Za-z]/u.test(cell.ch) && cell.owner.includes("label"));
        expect(named.length).toBeGreaterThan(0);
        expect([...new Set(named.map((cell) => cell.ground))]).toEqual(["#f4ecff"]);
        const outline = text.rows.flat().filter((cell) => cell.ch === "┌");
        expect(outline.every((cell) => cell.style.toLowerCase().includes("#7048e8"))).toBe(true);
      });
    }
  }
});
