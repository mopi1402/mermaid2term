import { describe, it, expect } from "vitest";
import { Canvas } from "../../src/canvas/canvas.js";
import { labelSeatClear, type Laid } from "../../src/diagrams/@common/box-diagram.js";
import { SPACE } from "../../src/text/chars.js";

const laid: Laid = {
  positions: new Map([["A", [10, 0]]]),
  sizes: new Map([["A", [4, 3]]]),
  width: 20,
  height: 6,
  layerOf: new Map(),
};

describe("labelSeatClear checks every row of a label block", () => {
  const canvas = new Canvas(20, 6);
  canvas.put(4, 3, "x");
  const blank = (r: number, c: number): boolean => canvas.get(r, c) === SPACE;

  it("accepts a block on blank cells away from every box", () => {
    expect(labelSeatClear(laid, canvas, 0, 1, 5, 3, blank)).toBe(true);
  });

  it("refuses a block over a box, over ink, or off the left or top edge", () => {
    expect(labelSeatClear(laid, canvas, 0, 8, 4, 1, blank)).toBe(false);
    expect(labelSeatClear(laid, canvas, 3, 1, 5, 2, blank)).toBe(false);
    expect(labelSeatClear(laid, canvas, 0, 0, 2, 1, blank)).toBe(false);
    expect(labelSeatClear(laid, canvas, -1, 1, 2, 1, blank)).toBe(false);
  });

  it("leaves the skipped row unread", () => {
    expect(labelSeatClear(laid, canvas, 3, 1, 5, 2, blank, 4)).toBe(true);
  });
});
