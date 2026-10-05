import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { watchTextClashes, type TextClash } from "../../src/canvas/canvas.js";
import { THREE_PANES } from "../support/drawn.js";

// A class self relation loops out of a wall no other relation meets, as ER picks the free flank for its own; with both
// flanks taken the other runs seat under the loop. Either way the loop and a relation never share a cell.
const heard: TextClash[] = [];
beforeAll(() => watchTextClashes((clash) => heard.push(clash)));
afterAll(() => watchTextClashes(undefined));

const HEADS = /[⏵⏴⏶⏷]/gu;
// A run merged into the loop: a tee right against its head or one cell off the wall it leaves.
const MERGES = /[⏴⏵][┴┬]|[├┤▏▕][─┄][┴┬]/u;

const BODIES: ReadonlyArray<readonly [string, string, number]> = [
  ["an arrival on the loop's wall", "A --> A : self\nB --> A : rel", 2],
  ["a departure on the loop's wall", "A --> A : self\nA --> B : rel", 2],
  ["both flanks taken", "A --> B\nB --> B : self\nB --> C : rel", 3],
  ["a fan off both flanks", "A --> B : in\nB --> B : self\nB --> C : rel\nB --> D", 4],
  ["a neighbour of the same layer", "A --> A : self\nB --> A\nB --> C\nC --> A : rel", 4],
];

function expectApart(direction: string, body: string, heads: number, width: number, padless: boolean): void {
  heard.length = 0;
  const source = `classDiagram\ndirection ${direction}\n${body}`;
  const text = render(source, padless ? { width, borders: "padless" } : { width });
  expect(heard, text).toEqual([]);
  expect(text.match(HEADS)?.length ?? 0, text).toBe(heads);
  expect(text, text).not.toMatch(MERGES);
  expect(text, text).toMatch(/⏴[─┄]*[┘╯]|[└╰][─┄]*⏵/u);
  expect(text).toContain("self");
  expect(text).toContain("rel");
}

describe("a class self relation beside another relation", () => {
  for (const direction of ["TB", "LR", "RL", "BT"]) {
    for (const [name, body, heads] of BODIES) {
      it(`${direction}, ${name}: the loop and the relation share no cell`, () => {
        for (const width of THREE_PANES) {
          expectApart(direction, body, heads, width, false);
          expectApart(direction, body, heads, width, true);
        }
      });
    }
  }

  it("RL loops out of the left wall when the relation arrives on the right one", () => {
    const rows = render("classDiagram\ndirection RL\nA --> A : self\nB --> A : rel", { width: 80 }).split("\n");
    const arrival = rows.findIndex((row) => row.includes("rel"));
    expect(rows[arrival]).toMatch(/└⏵│\s+│⏴─+ rel/u);
    expect(rows.some((row) => /┌─┤/u.test(row))).toBe(true);
  });

  it("LR loops out of the left wall when the relation leaves by the right one", () => {
    const rows = render("classDiagram\ndirection LR\nA --> A : self\nA --> B", { width: 80 }).split("\n");
    expect(rows.some((row) => /└⏵│\s+├─+⏵│/u.test(row))).toBe(true);
  });
});
