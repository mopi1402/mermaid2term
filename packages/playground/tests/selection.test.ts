// A hand-made selection copies the drawing's own characters, cut to the columns it covers.

import { describe, it, expect } from "vitest";
import { pick, sliceCells } from "@/selection";

const DRAWING = ["┌─────┐", "│ ab  │", "│ 日本 │", "└─────┘"].join("\n");

describe("what a selection copies", () => {
  it("takes the columns it covers on one line, and nothing of the lines around it", () => {
    expect(pick(DRAWING, { row: 1, column: 2 }, { row: 1, column: 4 }, false)).toBe("ab");
  });

  it("runs to the end of the first line, through the ones between, and into the last", () => {
    expect(pick(DRAWING, { row: 1, column: 2 }, { row: 3, column: 3 }, false)).toBe("ab  │\n│ 日本 │\n└──");
  });

  it("takes the same block whichever corner the drag started from", () => {
    const block = "───\n ab\n 日";
    expect(pick(DRAWING, { row: 0, column: 1 }, { row: 2, column: 4 }, true)).toBe(block);
    expect(pick(DRAWING, { row: 2, column: 4 }, { row: 0, column: 1 }, true)).toBe(block);
    expect(pick(DRAWING, { row: 0, column: 4 }, { row: 2, column: 1 }, true)).toBe(block);
  });

  it("reads a point before the one that opened the selection as the corner it is", () => {
    expect(pick(DRAWING, { row: 1, column: 4 }, { row: 1, column: 2 }, false)).toBe("ab");
  });

  it("takes a wide glyph whole, or leaves it whole, never half a character", () => {
    expect(sliceCells("日本", 0, 2)).toBe("日");
    expect(sliceCells("日本", 1, 2)).toBe("");
    expect(sliceCells("日本", 0, 3)).toBe("日本");
    expect(sliceCells("日本", 2, 4)).toBe("本");
  });

  it("copies nothing at all where the two points meet", () => {
    expect(pick(DRAWING, { row: 1, column: 3 }, { row: 1, column: 3 }, false)).toBe("");
    expect(pick(DRAWING, { row: 0, column: 2 }, { row: 3, column: 2 }, true)).toBe("\n\n\n");
  });
});
