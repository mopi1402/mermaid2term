import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const DIRECTIONS = ["TB", "BT", "LR", "RL"] as const;
const BORDERS = ["default", "padless"] as const;

const flowchart = (direction: string): string => `flowchart ${direction}\n  A[Start] -- again --> A\n  A -- next --> A\n  A --> B[Done]\n`;
const state = (direction: string): string => `stateDiagram-v2\n  direction ${direction}\n  A --> A : again\n  A --> A : next\n  A --> B\n`;

// The head each loop lays back on its box's wall: the box stands left of the loops, or right of them mirrored RL.
const headsBack = (drawn: string, direction: string): number => (drawn.match(direction === "RL" ? /─⏵/gu : /⏴─/gu) ?? []).length;

// Two loops on one box nest, as mermaid draws them: each keeps its own run, its own head and its whole label.
describe.each([
  ["flowchart", flowchart],
  ["state", state],
])("two self loops on one %s box", (_, source) => {
  it.each(DIRECTIONS.flatMap((direction) => BORDERS.map((borders) => [direction, borders] as const)))("nest (%s, %s)", (direction, borders) => {
    const drawn = render(source(direction), { width: 80, borders });
    expect(drawn).toContain("again");
    expect(drawn).toContain("next");
    expect(drawn).not.toContain("…");
    expect(headsBack(drawn, direction)).toBeGreaterThanOrEqual(2);
    // No fork: the loops never share a run, so no tee joins two of their returns.
    expect(drawn).not.toMatch(direction === "RL" ? /├─+⏵/u : /⏴─+┤/u);
  });
});

// Padless draws a lid on its cell's edge: a loop leaves it upwards, crossing the lid, rather than riding its row.
describe("a self loop on a padless box at the top of the drawing", () => {
  it.each(["LR", "RL"])("leaves through the lid (%s)", (direction) => {
    const drawn = render(`flowchart ${direction}\n  A[Start] -- again --> A\n  A --> B[Done]\n`, { width: 80, borders: "padless" });
    expect(drawn).toMatch(/▁│▁/u);
  });
});

// Five loops on one box: the box grows a lid cell and a wall row for each, and they nest inside out, never crossing.
describe("five self loops on one flowchart box", () => {
  const five = (direction: string): string =>
    `flowchart ${direction}\n${[1, 2, 3, 4, 5].map((n) => `  A[Start] -- ${n} --> A`).join("\n")}\n  A --> B[Done]\n`;

  it.each(DIRECTIONS.flatMap((direction) => BORDERS.map((borders) => [direction, borders] as const)))("nest apart (%s, %s)", (direction, borders) => {
    const drawn = render(five(direction), { width: 80, borders });
    expect(headsBack(drawn, direction)).toBe(5);
    // A crossing is cut, `─│─`, and two lid exits sharing a cell merge, `├─`: neither may show.
    expect(drawn).not.toMatch(/─│─|├─│/u);
    // The rows the loops lower the drawing by are counted in its height: the last floor is still drawn.
    expect(drawn.trimEnd().split("\n").at(-1)).toMatch(/[▔▁└╰]/u);
    expect(drawn).not.toMatch(direction === "RL" ? /├─+⏵/u : /⏴─+┤/u);
  });
});

// Across the page the run leaving the wall sinks under the nest instead of the box growing twice its rows.
describe("five self loops on a flowchart box across the page", () => {
  it("seat the leaving run under them, the floor right after it (LR)", () => {
    const rows = render(`flowchart LR\n${[1, 2, 3, 4, 5].map((n) => `  A[Start] -- ${n} --> A`).join("\n")}\n  A --> B[Done]\n`, { width: 80 }).split("\n");
    const leaving = rows.findIndex((row) => /├─+⏵/u.test(row));
    expect(rows[leaving + 1]).toMatch(/^└/u);
  });
});
