import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { must } from "../../src/must.js";
import { THREE_PANES } from "../support/drawn.js";

// TOP names its own direction, so turning the whole flow over leaves what it holds as it was.
const BODY =
  "  subgraph TOP\n    direction TB\n    subgraph B1\n        direction RL\n        i1 -->f1\n    end\n    subgraph B2\n        direction BT\n        i2 -->f2\n    end\n  end\n  A --> TOP --> B\n  B1 --> B2\n";

// What stands strictly inside TOP's frame, its walls and rules left out.
const inside = (drawing: string): string[] => {
  const rows = drawing.split("\n").map((row) => [...row]);
  const title = rows.findIndex((row) => row.join("").includes(" TOP "));
  const left = rows[title].join("").lastIndexOf("│", rows[title].join("").indexOf(" TOP "));
  const lid = rows[title - 1];
  const right = lid.lastIndexOf("┐");
  const floor = title + rows.slice(title).findIndex((row) => row[left] === "└");
  expect(right).toBeGreaterThan(left);
  return rows.slice(title, floor).map((row) => row.slice(left + 1, right).join(""));
};

describe("a frame drawn against the flow holds what it holds the way it does along it", () => {
  // Turned over sideways, the middle of an even box is the other of its two middle cells: the glyphs are compared
  // row by row, the run and the tee it leaves by standing one column over.
  it.each([
    ["TD", "TB", "BT", (row: string) => row],
    ["LR", "LR", "RL", (row: string) => row.replace(/[ ─]/gu, "")],
  ] as const)("the same inside TOP turned over, direction %s", (_, along, against, read) => {
    for (const borders of ["default", "borderless"] as const) {
      for (const width of THREE_PANES) {
        const ahead = inside(render(`flowchart ${along}\n${BODY}`, { width, borders })).map(read);
        const back = inside(render(`flowchart ${against}\n${BODY}`, { width, borders })).map(read);
        expect(back).toEqual(ahead);
        expect(must(back.find((row) => row.includes("⏷")))).toBeDefined();
      }
    }
  });
});
