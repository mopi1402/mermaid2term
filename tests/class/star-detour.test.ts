// A class joined to three classes of its own layer cannot stand beside all of them: the links that reached past a
// neighbour ran straight through it. They now ride round past the layer's far side.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const DIRECTIONS = ["TB", "BT", "LR", "RL"] as const;
const BORDERS = ["default", "padless", "borderless"] as const;
const WIDTHS = [40, 80, 120] as const;
const CLASSES = ["A", "B", "C", "D"];

// The cells a run over a class would take: its name row and its two blank compartment rows, walls left out.
function crossedCells(drawn: string, name: string): string[] {
  const rows = drawn.split("\n");
  const at = rows.findIndex((row) => row.includes(`     ${name} `));
  const col = rows[at].indexOf(`     ${name} `) + 5;
  return [at, at + 2, at + 4].flatMap((row) =>
    [...(rows[row] ?? "")].slice(col - 5, col + 7).flatMap((ch, k) => (ch === " " || (row === at && k === 5) ? [] : [`${row}:${col - 5 + k} ${ch}`]))
  );
}

const source = (direction: string, label: string): string =>
  `classDiagram\n  direction ${direction}\n  Root --> A\n  Root --> B\n  Root --> C\n  Root --> D\n  A -- B\n  A -- C${label}\n  A -- D`;

describe("class star within one layer rides round its neighbours", () => {
  for (const direction of DIRECTIONS) {
    for (const borders of BORDERS) {
      for (const width of WIDTHS) {
        for (const label of ["", " : owns"]) {
          it(`${direction} ${borders} ${width}${label === "" ? "" : " labelled"}`, () => {
            const drawn = render(source(direction, label), { width, borders });
            expect(drawn).not.toContain("┼");
            for (const name of CLASSES) expect(crossedCells(drawn, name), name).toEqual([]);
            if (label !== "") expect(drawn).toContain("owns");
          });
        }
      }
    }
  }
});
