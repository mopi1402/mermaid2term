import type { Canvas } from "./canvas.js";
import { BOX, DASH, heavier } from "./alphabet.js";
import type { CharSet } from "./model.js";
import { PROP_STROKE_DASHARRAY, PROP_STROKE_WIDTH } from "../source/css.js";
import { SPACE } from "../text/chars.js";

export const lineStrokes = (cs: CharSet, dashed: boolean): [string, string] =>
  dashed ? [cs.lineDottedH, cs.lineDottedV] : [cs.lineHorizontal, cs.lineVertical];

export const HEAVY_FROM_WIDTH = 2;
export const NO_BORDER_WIDTH = 0;
export const strokeWidthOf = (props: ReadonlyMap<string, string>): number | undefined => {
  const written = props.get(PROP_STROKE_WIDTH);
  if (written === undefined) return undefined;
  const width = Number.parseFloat(written);
  return Number.isNaN(width) ? undefined : width;
};

interface DashWeight {
  readonly double: string;
  readonly triple: string;
  readonly quadruple: string;
}
// A stroke from solid through ever sparser dashes down to a lone half arm.
const dashRun = (solid: string, dashes: DashWeight, half: string): string[] => [solid, dashes.quadruple, dashes.triple, dashes.double, half];

export const LIGHT_DASH_ACROSS = dashRun(BOX.across, DASH.across.light, BOX.halfLeft);
export const LIGHT_DASH_DOWN = dashRun(BOX.down, DASH.down.light, BOX.halfUp);
export const HEAVY_DASH_ACROSS = dashRun(BOX.heavyAcross, DASH.across.heavy, BOX.heavyHalfLeft);
export const HEAVY_DASH_DOWN = dashRun(BOX.heavyDown, DASH.down.heavy, BOX.heavyHalfUp);
const SPARSE_LEVEL = 5;
const COARSEST = 4;

export const dashLevelOf = (props: ReadonlyMap<string, string>): number => {
  const written = props.get(PROP_STROKE_DASHARRAY);
  if (written === undefined) return 0;
  const found = /\d*\.?\d+/u.exec(written) ?? undefined;
  return found === undefined ? 0 : Math.max(0, Math.ceil(Number.parseFloat(found[0])));
};

interface DashGlyphs {
  across: (at: number) => string;
  down: (at: number) => string;
}

export function dashGlyphs(level: number, heavy: boolean): DashGlyphs | undefined {
  if (level <= 0) return undefined;
  const acrossSet = heavy ? HEAVY_DASH_ACROSS : LIGHT_DASH_ACROSS;
  const downSet = heavy ? HEAVY_DASH_DOWN : LIGHT_DASH_DOWN;
  const downLevel = Math.max(1, Math.min(level, SPARSE_LEVEL) - 1);
  const down = downSet[downLevel];
  if (level >= SPARSE_LEVEL) {
    const solid = acrossSet[0];
    return { across: (at) => (at % 2 === 1 ? solid : SPACE), down: () => down };
  }
  const across = acrossSet[Math.min(level, COARSEST)];
  return { across: () => across, down: () => down };
}

export function restyleBox(
  canvas: Canvas,
  top: number,
  left: number,
  height: number,
  width: number,
  props: ReadonlyMap<string, string>,
  cs: CharSet
): void {
  const strokeWidth = strokeWidthOf(props);
  const gone = strokeWidth === NO_BORDER_WIDTH;
  const heavy = strokeWidth !== undefined && strokeWidth >= HEAVY_FROM_WIDTH;
  const dashes = dashGlyphs(dashLevelOf(props), heavy);
  if (dashes === undefined && !heavy && !gone) return;

  const bottom = top + height - 1;
  const right = left + width - 1;
  if (gone) {
    for (let c = left; c <= right; c++) {
      canvas.recast(top, c, SPACE);
      canvas.recast(bottom, c, SPACE);
    }
    for (let r = top + 1; r < bottom; r++) {
      canvas.recast(r, left, SPACE);
      canvas.recast(r, right, SPACE);
    }
    return;
  }
  // A box's corners, square, rounded, a composite state's double floor, or the tees its body hangs from under the
  // divider: anything else is not a box drawn here.
  const corner = (r: number, c: number, glyphs: readonly string[]): boolean => glyphs.includes(canvas.get(r, c));
  if (
    !corner(top, left, [cs.topLeft, cs.roundTopLeft, cs.teeRight]) ||
    !corner(top, right, [cs.topRight, cs.roundTopRight, cs.teeLeft]) ||
    !corner(bottom, left, [cs.bottomLeft, cs.roundBottomLeft, cs.floorLeft]) ||
    !corner(bottom, right, [cs.bottomRight, cs.roundBottomRight, cs.floorRight])
  )
    return;

  if (heavy) {
    const recast = (r: number, c: number): void => {
      const to = heavier(canvas.get(r, c), (r === top || r === bottom) && (c === left || c === right));
      if (to !== undefined) canvas.recast(r, c, to);
    };
    for (let c = left; c <= right; c++) {
      recast(top, c);
      recast(bottom, c);
    }
    for (let r = top + 1; r < bottom; r++) {
      recast(r, left);
      recast(r, right);
    }
  }
  if (dashes === undefined) return;
  const plainAcross = (heavy ? HEAVY_DASH_ACROSS : LIGHT_DASH_ACROSS)[0];
  const plainDown = (heavy ? HEAVY_DASH_DOWN : LIGHT_DASH_DOWN)[0];
  for (let c = left + 1; c < right; c++) {
    if (canvas.get(top, c) === plainAcross) canvas.recast(top, c, dashes.across(c - left));
    if (canvas.get(bottom, c) === plainAcross) canvas.recast(bottom, c, dashes.across(c - left));
  }
  for (let r = top + 1; r < bottom; r++) {
    if (canvas.get(r, left) === plainDown) canvas.recast(r, left, dashes.down(r - top));
    if (canvas.get(r, right) === plainDown) canvas.recast(r, right, dashes.down(r - top));
  }
}
