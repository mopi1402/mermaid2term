import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { segmentCells } from "../../src/canvas/geometry.js";

// The flowchart docs' subgraph example: two clusters two rows apart, two edges arriving on the same wall cell.
const DOCS = [
  "c1-->a2",
  "subgraph one",
  "a1-->a2",
  "end",
  "subgraph two",
  "b1-->b2",
  "end",
  "one --> two",
  "three --> two",
  "two --> c2",
].join("\n");

describe("two edges arriving on the same wall cell, one of them along the wall", () => {
  it.each(["TB", "LR"])("renders the docs example in %s: spreading the arrivals never folds a path into a diagonal", (direction) => {
    const out = render(`flowchart ${direction}\n${DOCS}`, { width: 80 });
    expect(out).toContain("one");
    expect(out).toContain("two");
    expect(out.split("\n").length).toBeGreaterThan(10);
  });

  it("refuses a segment off the 45° diagonal instead of walking it forever", () => {
    expect(() => [...segmentCells([7, 16], [24, 19])]).toThrow(/unreachable/);
    expect([...segmentCells([1, 1], [1, 3])]).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
    ]);
  });
});
