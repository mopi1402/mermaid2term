// A label must read as its own run's and no other's. Two runs back and forth between Start and Check set `ko` on the
// row between them, against both: the reader could not tell which way it was said. It now takes the free side of its
// own run, under it, where no other run touches it.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const source = (direction: string): string => `flowchart ${direction}
    A[Start] --> B{Check}
    B -->|ok| C[Work]
    B -->|ko| A
    C --> D{Again?}
    D -->|yes| B
    D -->|no| E[End]
`;

const RUNS = /[─━┄┈│┃┊┆╭╮╰╯⏴⏵⏶⏷]/u;

// The rows above and below `ko`, over its own columns, and the cells at either end of it.
const aroundKo = (drawn: string): { above: string; below: string; ends: string } => {
  const rows = drawn.split("\n").map((line) => [...line]);
  const row = rows.findIndex((cells) => cells.join("").includes("ko"));
  const col = rows[row].join("").indexOf("ko");
  const span = (r: number): string => rows[r].slice(col, col + 2).join("");
  return { above: span(row - 1), below: span(row + 1), ends: `${rows[row][col - 1] ?? " "}${rows[row][col + 2] ?? " "}` };
};

describe("a label touches its own run and no other", () => {
  it.each(["default", "padless"] as const)("sits under its own run, clear of the run back (LR, %s)", (borders) => {
    const drawn = render(source("LR"), { width: 120, borders });
    const { above, below } = aroundKo(drawn);
    expect(above).toMatch(/^[─⏴]+$/u);
    expect(below).not.toMatch(RUNS);
  });

  it.each(["default", "padless"] as const)("stands against its own run and clear of the run back (TD, %s)", (borders) => {
    const drawn = render(source("TD"), { width: 120, borders });
    const { above, below, ends } = aroundKo(drawn);
    const line = drawn.split("\n").find((row) => row.includes("ko")) ?? "";
    expect(line.slice(0, line.indexOf("ko")).trimEnd().endsWith("│")).toBe(true);
    expect(`${above}${below}${ends[1]}`).not.toMatch(RUNS);
  });
});
