import type { CharSet } from "./model.js";
import { ACROSS, DOWN, DOWNWARD, RIGHT } from "./merge.js";

export const cornersOf = (cs: CharSet, rounded: boolean, heavy = false): readonly [string, string, string, string] =>
  heavy
    ? [cs.heavyTopLeft, cs.heavyTopRight, cs.heavyBottomLeft, cs.heavyBottomRight]
    : rounded
    ? [cs.roundTopLeft, cs.roundTopRight, cs.roundBottomLeft, cs.roundBottomRight]
    : [cs.topLeft, cs.topRight, cs.bottomLeft, cs.bottomRight];

export const clusterCornersOf = (cs: CharSet): readonly [string, string, string, string] => [cs.sgTopLeft, cs.sgTopRight, cs.sgBottomLeft, cs.sgBottomRight];

export type Toward = "up" | "down" | "left" | "right";

/** The tee a frame wears where a line leaves it: the stub points the way the line goes. */
export const teeToward = (cs: CharSet, toward: Toward): string =>
  toward === "up" ? cs.teeUp : toward === "down" ? cs.teeDown : toward === "left" ? cs.teeLeft : cs.teeRight;

const BACK: Readonly<Record<Toward, Toward>> = { up: "down", down: "up", left: "right", right: "left" };

/** The heading of one step along a single axis, none for a diagonal or no step at all. */
export const towardOf = (dx: number, dy: number): Toward | undefined =>
  dx !== 0 && dy !== 0 ? undefined : dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : dy < 0 ? "up" : undefined;

/** The corner a line heading `inward` turns on to head `outward`, none where it does not turn a quarter. */
export function cornerOf(inward: Toward, outward: Toward, cs: CharSet, rounded: boolean, heavy = false): string | undefined {
  const arms = [BACK[inward], outward];
  const down = arms.includes("down") ? true : arms.includes("up") ? false : undefined;
  const right = arms.includes("right") ? true : arms.includes("left") ? false : undefined;
  if (down === undefined || right === undefined) return undefined;
  const [topLeft, topRight, bottomLeft, bottomRight] = cornersOf(cs, rounded, heavy);
  return down ? (right ? topLeft : topRight) : right ? bottomLeft : bottomRight;
}

/** The glyph a cell wears for the arms it has, read as `UP | DOWN | LEFT | RIGHT`; a lone arm reads as its whole stroke. */
export function glyphOfArms(arms: number, cs: CharSet, rounded: boolean): string {
  const across = arms & ACROSS;
  const downward = arms & DOWNWARD;
  if (downward === 0) return cs.lineHorizontal;
  if (across === 0) return cs.lineVertical;
  if (across === ACROSS && downward === DOWNWARD) return cs.cross;
  if (across === ACROSS) return teeToward(cs, downward === DOWN ? "down" : "up");
  if (downward === DOWNWARD) return teeToward(cs, across === RIGHT ? "right" : "left");
  const [topLeft, topRight, bottomLeft, bottomRight] = cornersOf(cs, rounded);
  if (downward === DOWN) return across === RIGHT ? topLeft : topRight;
  return across === RIGHT ? bottomLeft : bottomRight;
}
