import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const DIRECTIONS = ["TB", "BT", "LR", "RL"] as const;
const BORDERS = ["default", "padless"] as const;
const CASES = DIRECTIONS.flatMap((direction) => BORDERS.map((borders) => [direction, borders] as const));

const two = (direction: string): string => `classDiagram\n  direction ${direction}\n  A <|-- A : self\n  A *-- A : own\n  A <-- B\n`;
const five = (direction: string): string =>
  `classDiagram\n  direction ${direction}\n${[1, 2, 3, 4, 5].map((n) => `  A --> A : ${n}`).join("\n")}\n  A <-- B\n`;

const count = (drawn: string, pattern: RegExp): number => (drawn.match(pattern) ?? []).length;
const ROUND_CORNERS = /[╭╮╰╯]/gu;

// Every loop keeps its own run, so no two of them cross, cut one another or share a corner.
const expectApart = (drawn: string, loops: number): void => {
  expect(drawn).not.toContain("…");
  expect(drawn).not.toMatch(/─│─|┼/u);
  expect(count(drawn, ROUND_CORNERS)).toBeGreaterThanOrEqual(3 * loops);
};

// Several self relations on one class nest inside out, each with its own marks, its own label and its own cells.
describe("two self relations on one class", () => {
  it.each(CASES)("nest (%s, %s)", (direction, borders) => {
    const drawn = render(two(direction), { width: 80, borders });
    expect(drawn).toContain("self");
    expect(drawn).toContain("own");
    expect(count(drawn, /◆/gu)).toBe(1);
    expect(count(drawn, /[▽△◁▷]/gu)).toBe(1);
    expectApart(drawn, 2);
  });
});

describe("five self relations on one class", () => {
  it.each(CASES)("nest (%s, %s)", (direction, borders) => {
    const drawn = render(five(direction), { width: 80, borders });
    for (const label of ["1", "2", "3", "4", "5"]) expect(drawn).toMatch(new RegExp(`(^|[^0-9])${label}([^0-9]|$)`, "mu"));
    // A head per loop, and the neighbour's own.
    expect(count(drawn, /[⏴⏵⏶⏷]/gu)).toBe(6);
    expectApart(drawn, 5);
  });
});
