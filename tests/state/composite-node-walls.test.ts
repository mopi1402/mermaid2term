import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { type BorderMode } from "../../src/options.js";
import { stripSgr } from "../support/ansi.js";
import { paintedCells } from "../support/grid.js";

// The ground under a state's name and under the wall glyph either side of it, on the row the name stands on.
function wallsOf(source: string, borders: BorderMode, name: string): readonly [string, string, string] {
  const row = renderThemedText(source, { width: 120, borders }, "dracula").toAnsi().split("\n").find((line) => stripSgr(line).includes(name)) ?? "";
  const cells = paintedCells(row);
  const text = cells.map(({ ch }) => ch).join("");
  const from = text.indexOf(name);
  const isWall = (ch: string): boolean => ch !== " ";
  const left = [...text.slice(0, from)].length - 1 - [...text.slice(0, from)].reverse().findIndex(isWall);
  const right = from + name.length + [...text.slice(from + name.length)].findIndex(isWall);
  return [cells[left].ground, cells[from].ground, cells[right].ground];
}

const sources = (direction: string): ReadonlyArray<readonly [string, string, string]> => [
  ["outside any composite", `stateDiagram-v2\n  direction ${direction}\n  [*] --> alone`, "alone"],
  ["in a composite", `stateDiagram-v2\n  direction ${direction}\n  state First {\n    [*] --> second\n  }`, "second"],
  ["two composites down", `stateDiagram-v2\n  direction ${direction}\n  state Outer {\n    state Nested {\n      check --> sign\n    }\n  }`, "check"],
];

describe("a state's walls stand on its own fill, wherever it is nested", () => {
  for (const direction of ["TB", "LR"]) {
    for (const [where, source, name] of sources(direction)) {
      it(`${where}, ${direction}, padless`, () => {
        const [left, inside, right] = wallsOf(source, "padless", name);
        expect(left).toBe(inside);
        expect(right).toBe(inside);
      });
    }
  }
});
