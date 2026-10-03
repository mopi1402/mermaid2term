import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { type BorderMode } from "../../src/options.js";
import { THREE_PANES } from "../support/drawn.js";

const SOURCE = ["Web --> Api", "Web --> Db", "subgraph Backend", "Api --> Cache", "Db", "end"].join("\n");

const HEADS: Readonly<Record<string, string>> = { TD: "⏷", BT: "⏶", LR: "⏵", RL: "⏴" };
const MODES: readonly BorderMode[] = ["default", "padless", "borderless"];
const CASES = ["TD", "LR", "BT", "RL"].flatMap((direction) => MODES.map((borders): [string, BorderMode] => [direction, borders]));

// The column one past the frame's right wall, read on the row that holds its name.
function pastFrame(out: string): number {
  const named = out.split("\n").find((line) => line.includes("Backend"));
  expect(named).toBeDefined();
  return [...(named ?? "").trimEnd()].length;
}

describe("a bare node fanning into two members of a frame", () => {
  it.each(CASES)(
    "enters each member straight across the wall in %s, %s, never crossing its own legs nor running round the frame",
    (direction, borders) => {
      for (const width of THREE_PANES) {
        const out = render(`flowchart ${direction}\n${SOURCE}`, { width, borders });
        expect(out).not.toContain("┼");
        const wall = pastFrame(out);
        const beyond = out.split("\n").filter((line) => [...line.trimEnd()].length > wall);
        if (direction !== "RL") expect(beyond).toEqual([]);
        const heads = [...out].filter((ch) => ch === HEADS[direction]).length;
        expect(heads).toBe(3);
      }
    }
  );
});
