import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { type BorderMode } from "../../src/options.js";
import { gridOf } from "../support/grid.js";

const SOURCE = `sequenceDiagram
    participant A as Alpha
    collections C as Col
    A->>C: fetch`;

// The grounds on the name's row inside the front box: its blanks and its letters alike.
function interior(borders: BorderMode, theme: string): string[] {
  const grid = gridOf(renderThemedText(SOURCE, { width: 80, borders }, theme));
  const row = grid.find((cells) => cells.map((cell) => cell.ch).join("").includes("Col"));
  if (row === undefined) throw new Error("Col is not drawn");
  const text = row.map((cell) => cell.ch).join("");
  const name = text.indexOf("Col");
  // The walls, whatever glyph the border mode draws them in: the first ink met on either side of the name.
  let left = name - 1;
  while (left > 0 && text[left] === " ") left -= 1;
  let right = name + "Col".length;
  while (right < text.length && text[right] === " ") right += 1;
  return row.slice(left + 1, right).map((cell) => cell.ground);
}

// mermaid fills both rects of a collections actor with actorBkg: the front box is filled, not only its name.
describe("a collections actor's front box is filled, blanks and name on one ground", () => {
  for (const theme of ["dracula", "default"]) {
    for (const borders of ["default", "padless", "borderless"] satisfies BorderMode[]) {
      it(`${theme}, ${borders}`, () => {
        const grounds = interior(borders, theme);
        expect(grounds[0]).not.toBe("");
        expect(new Set(grounds).size).toBe(1);
      });
    }
  }
});
