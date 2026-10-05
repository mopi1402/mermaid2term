// A relation within one layer runs straight from wall to wall, so a class seated between its two ends was crossed:
// `B <|-- E` went through C, `┼` on its walls and a `│` over its name. The two ends now stand side by side.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const DIRECTIONS = ["TB", "BT", "LR", "RL"] as const;
const BORDERS = ["default", "padless"] as const;
const CLASSES = ["A", "B", "C", "D", "E", "F"];

// The cells a run over a class would take: its name row and its two blank compartment rows, walls left out.
function crossedCells(drawn: string, name: string): string[] {
  const rows = drawn.split("\n");
  const at = rows.findIndex((row) => row.includes(`     ${name}`));
  const col = rows[at].indexOf(`     ${name}`) + 5;
  return [at, at + 2, at + 4].flatMap((row) =>
    [...(rows[row] ?? "")].slice(col - 5, col + 7).flatMap((ch, k) => (ch === " " || (row === at && k === 5) ? [] : [`${row}:${col - 5 + k} ${ch}`]))
  );
}

const source = (direction: string, label: string): string =>
  `classDiagram\n  direction ${direction}\n  A <|-- B\n  A <|-- C\n  B <|-- E${label}\n  D <|-- E\n  C <|-- F`;

describe("class relation never runs through a box", () => {
  for (const direction of DIRECTIONS) {
    for (const borders of BORDERS) {
      for (const label of ["", " : grows"]) {
        it(`${direction} ${borders}${label === "" ? "" : " labelled"}`, () => {
          const drawn = render(source(direction, label), { width: 80, borders });
          expect(drawn).not.toContain("┼");
          for (const name of CLASSES) expect(crossedCells(drawn, name), name).toEqual([]);
          expect([...drawn].filter((ch) => "△▽◁▷".includes(ch))).toHaveLength(5);
          if (label !== "") expect(drawn).toContain("grows");
        });
      }
    }
  }
});
