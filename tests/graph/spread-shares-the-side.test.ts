// A box's links share its side out: two runs leaving a wide box stood two cells apart in its middle whatever its width,
// and now stand as far from each other as from its corners. A seat shared out wider moves its whole stem, so it holds
// only where that stem then stands clear of every other box: `served` rose onto Cold path's wall.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

// The columns, or rows, the runs leave the box's bottom, or right, side on.
const seats = (drawn: string, horizontal: boolean): number[] => {
  const rows = drawn.split("\n").map((row) => [...row]);
  if (!horizontal) {
    const floor = rows.find((row) => row.includes("┬")) ?? [];
    return floor.flatMap((g, c) => (g === "┬" ? [c] : []));
  }
  const col = Math.max(...rows.map((row) => row.indexOf("├")));
  return rows.flatMap((row, r) => (row[col] === "├" ? [r] : []));
};

describe("a box's links share its side out", () => {
  it("TD: two runs leave a wide box a third of its width apart", () => {
    const drawn = render("flowchart TD\n    A[a rather wide load balancer] --> B[left]\n    A --> C[right]", { width: 80 });
    const [first, second] = seats(drawn, false);
    expect(second - first).toBeGreaterThan(4);
  });

  it("LR: two runs leave a tall box a third of its height apart", () => {
    const drawn = render('flowchart LR\n    A["one<br>two<br>three<br>four<br>five<br>six<br>seven"] --> B[up]\n    A --> C[down]', { width: 80 });
    const [first, second] = seats(drawn, true);
    expect(second - first).toBeGreaterThan(2);
  });
});

describe("a seat shared out wider never sets its stem on another box", () => {
  it("served rises beside Cold path, never on its wall", () => {
    const source = [
      "stateDiagram-v2",
      '    state "Waiting for the reader" as wait',
      "    hot : Hot path<br>cache warm",
      '    cold : "`**Cold** path, _rebuilt_`"',
      "    money : Costs #36;0.02",
      "    wait --> hot : hit",
      "    wait --> cold : miss",
      "    cold --> money : rebuild",
      "    money --> wait : served",
    ].join("\n");
    const rows = render(source, { width: 40 }).split("\n");
    const head = rows.find((row) => row.includes("⏶")) ?? "";
    const stem = [...head].indexOf("⏶");
    const lid = rows[rows.findIndex((row) => row.includes("Cold path")) - 1] ?? "";
    const left = [...lid].lastIndexOf("╭");
    expect(stem).toBeLessThan(left - 1);
  });
});
