import { BLOCK, QUADRANT_ARC } from "./alphabet.js";
import { HEAVY, LIGHT, type Weight } from "./arms.js";
import { BLANK_CELL } from "./cells.js";

export const PAD_RULES: ReadonlyMap<Weight, readonly [top: string, bottom: string, left: string, right: string]> = new Map([
  [LIGHT, [BLOCK.lowerEighth, BLOCK.upperEighth, BLOCK.rightEighth, BLOCK.leftEighth]],
  [HEAVY, [BLOCK.lowerHalf, BLOCK.upperHalf, BLOCK.rightHalf, BLOCK.leftHalf]],
]);

// Read as [top-left, top-right, bottom-left, bottom-right], the order the frame fitters index them by.
export const PAD_ROUND_CORNERS: readonly [string, string, string, string] = [
  QUADRANT_ARC.topLeft,
  QUADRANT_ARC.topRight,
  QUADRANT_ARC.bottomLeft,
  QUADRANT_ARC.bottomRight,
];

export const PAD_CORNERS: ReadonlyMap<Weight, readonly [string, string, string, string]> = new Map([
  [LIGHT, [BLANK_CELL, BLANK_CELL, BLANK_CELL, BLANK_CELL]],
  [HEAVY, [BLOCK.lowerRight, BLOCK.lowerLeft, BLOCK.upperRight, BLOCK.upperLeft]],
]);

export const RULE_WEIGHTS: ReadonlyMap<string, Weight> = new Map(
  [...PAD_RULES].flatMap(([weight, glyphs]) => glyphs.map((glyph): [string, Weight] => [glyph, weight]))
);
