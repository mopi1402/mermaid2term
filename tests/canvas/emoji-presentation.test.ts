import { describe, expect, it } from "vitest";
import { Canvas } from "../../src/canvas/canvas.js";
import { SHADOW } from "../../src/canvas/merge.js";

describe("an emoji asked for in colour by U+FE0F is one glyph two cells wide", () => {
  it("keeps the selector on its base and the next cell for it", () => {
    const canvas = new Canvas(6, 1);
    canvas.putText(0, 0, "\u{1f3f7}️ x");
    expect(canvas.get(0, 0)).toBe("\u{1f3f7}️");
    expect(canvas.get(0, 1)).toBe(SHADOW);
    expect(canvas.get(0, 3)).toBe("x");
  });
});
