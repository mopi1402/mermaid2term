import { Canvas, DEFAULT_STYLE } from "../../canvas/canvas.js";
import { BLOCK, BOX, stubOf } from "../../canvas/alphabet.js";
import { LIGHT } from "../../canvas/arms.js";
import { NodeShape } from "../shapes.js";
import { type CharSet } from "../../canvas/model.js";

import { BLANK_CELL, edgeKeyOutside, edgeStrokeOutside } from "../../canvas/cells.js";
import { padRuleRow } from "./tight.js";
import { PAD_RULES } from "../../canvas/pad-glyphs.js";
import { RIM_TAIL } from "../../canvas/keys.js";
import { SLAB_BOTTOM, SLAB_LEFT, SLAB_RIGHT, SLAB_TOP } from "./slabs.js";
import { must } from "../../must.js";
import { FLAG_LOWER, FLAG_UPPER } from "./angles.js";
export function padDividedBand(canvas: Canvas, top: number, bottom: number, left: number, right: number, key: string): void {
  const r = top + 1;
  if (r >= bottom || canvas.get(r, left) !== BOX.teeRight || canvas.get(r, right) !== BOX.teeLeft) return;
  padRuleRow(canvas, r, left, right, key);
}

const braceHooks = (cs: CharSet, waist: string): readonly [top: string, foot: string] | undefined =>
  waist === cs.braceLeft.waist ? [cs.braceLeft.top, cs.braceLeft.foot] : waist === cs.braceRight.waist ? [cs.braceRight.top, cs.braceRight.foot] : undefined;

export function padBraces(canvas: Canvas, cs: CharSet, top: number, bottom: number, left: number, right: number): void {
  let first = -1;
  let last = -1;
  for (let r = top; r <= bottom; r++) {
    for (let c = left + 1; c < right; c++) {
      if (!canvas.isText(r, c)) continue;
      if (first === -1) first = r;
      last = r;
    }
  }
  if (first === -1) return;
  const braceTop = Math.max(top, first - 1);
  const braceBottom = Math.min(bottom, last + 1);
  for (const c of [left, right]) {
    let hooks: readonly [string, string] | undefined;
    for (let r = top; r <= bottom && hooks === undefined; r++) hooks = braceHooks(cs, canvas.get(r, c));
    if (hooks === undefined) continue;
    for (let r = top; r <= bottom; r++) {
      if (r < braceTop || r > braceBottom) {
        canvas.recast(r, c, BLANK_CELL);
        canvas.setStyle(r, c, DEFAULT_STYLE);
      } else if (r === braceTop) canvas.recast(r, c, hooks[0]);
      else if (r === braceBottom) canvas.recast(r, c, hooks[1]);
    }
  }
}

export const SHEARED_SHAPES = new Set([NodeShape.PARALLELOGRAM, NodeShape.PARALLELOGRAM_ALT, NodeShape.TRAPEZOID, NodeShape.TRAPEZOID_ALT]);

export function padShearedFlats(canvas: Canvas, cs: CharSet, top: number, bottom: number, left: number, right: number, key: string): void {
  if (bottom - top < 2) return;
  const rise = cs.slopeRise;
  const fall = cs.slopeFall;
  const rules = must(PAD_RULES.get(LIGHT));
  const span = (row: number, atTop: boolean): readonly [number, number] | undefined => {
    let first = -1;
    let last = -1;
    for (let c = left; c <= right; c++) {
      const ch = canvas.get(row, c);
      if (ch !== rise && ch !== fall) continue;
      if (first === -1) first = c;
      last = c;
    }
    if (first === -1 || last === first) return undefined;
    const leftRise = canvas.get(row, first) === rise;
    const rightRise = canvas.get(row, last) === rise;
    const from = atTop === leftRise ? first + 1 : first;
    const to = atTop === rightRise ? last : last - 1;
    return [from, to];
  };
  for (const [r, beside, glyph, atTop] of [
    [top, top + 1, rules[0], true],
    [bottom, bottom - 1, rules[1], false],
  ] as const) {
    const flat = span(beside, atTop);
    if (flat === undefined) continue;
    for (let c = left; c <= right; c++) {
      if (canvas.isText(r, c)) continue;
      const inside = c >= flat[0] && c <= flat[1];
      canvas.recast(r, c, inside ? glyph : BLANK_CELL);
      canvas.setStyle(r, c, inside ? key : DEFAULT_STYLE);
    }
  }
}

export function padFlagNotch(canvas: Canvas, cs: CharSet, top: number, bottom: number, left: number): void {
  for (let r = top + 1; r < bottom; r++) {
    const ch = canvas.get(r, left);
    const slope = ch === FLAG_UPPER ? cs.slopeFall : ch === FLAG_LOWER ? cs.slopeRise : undefined;
    if (slope !== undefined) canvas.recast(r, left, slope);
  }
}

// An edge teed into a pill's rule from outside keeps its own stroke there, so the rule leaves that cell alone.
function edgeThroughRule(canvas: Canvas, r: number, c: number, top: number, bottom: number, left: number, right: number): boolean {
  const tee = stubOf(canvas.get(r, c));
  if (tee === undefined || !((r === top && tee[0] === "up") || (r === bottom && tee[0] === "down"))) return false;
  canvas.recast(r, c, edgeStrokeOutside(canvas, r, c, top, bottom, left, right, tee[1]));
  canvas.setStyle(r, c, edgeKeyOutside(canvas, r, c, top, bottom, left, right));
  return true;
}

export function padStadium(canvas: Canvas, top: number, bottom: number, left: number, right: number, key: string, slab: string): void {
  const height = bottom - top + 1;
  if (height < 3 || right - left < 2 * PILL_STEPS + 1) return;
  const put = (r: number, c: number, glyph: string): void => {
    if (canvas.isText(r, c)) return;
    canvas.recast(r, c, glyph);
    canvas.setStyle(r, c, glyph === BLANK_CELL ? DEFAULT_STYLE : key);
  };
  const rule = (r: number, c: number, glyph: string): void => {
    if (!edgeThroughRule(canvas, r, c, top, bottom, left, right)) put(r, c, glyph);
  };
  const shouldered = height >= 4;
  const inset = shouldered ? PILL_STEPS : 1;
  for (let r = top + 1; r < bottom; r++) {
    if (shouldered && (r === top + 1 || r === bottom - 1)) continue;
    canvas.setStyle(r, left, `${key}${RIM_TAIL}`);
    canvas.setStyle(r, right, `${key}${RIM_TAIL}`);
  }
  for (let c = left; c <= right; c++) {
    const flat = c >= left + inset && c <= right - inset;
    if (flat) {
      rule(top, c, BLOCK.lowerEighth);
      rule(bottom, c, BLOCK.upperEighth);
    } else {
      put(top, c, BLANK_CELL);
      put(bottom, c, BLANK_CELL);
    }
  }
  if (!shouldered) return;
  const [tl, tr, bl, br] = PILL_SHOULDERS;
  for (const [r, l, rt] of [
    [top + 1, tl, tr],
    [bottom - 1, bl, br],
  ] as const) {
    put(r, left, BLANK_CELL);
    put(r, right, BLANK_CELL);
    canvas.recast(r, left + 1, l);
    canvas.setStyle(r, left + 1, slab);
    canvas.recast(r, right - 1, rt);
    canvas.setStyle(r, right - 1, slab);
  }
}

const PILL_SHOULDERS: readonly [topLeft: string, topRight: string, bottomLeft: string, bottomRight: string] = [
  BLOCK.lessUpperLeft,
  BLOCK.lessUpperRight,
  BLOCK.lessLowerLeft,
  BLOCK.lessLowerRight,
];

const PILL_END = BLOCK.lowerQuarter;

const PILL_STEPS = 2;

export function pillBorders(canvas: Canvas, top: number, bottom: number, left: number, right: number, blockKey: string): void {
  const height = bottom - top + 1;
  if (height < 2 || right - left < 2 * PILL_STEPS + 1) return;
  const block = (r: number, c: number, glyph: string): void => {
    if (canvas.isText(r, c)) return;
    canvas.recast(r, c, glyph);
    canvas.setStyle(r, c, blockKey);
  };
  const clear = (r: number, c: number): void => {
    if (canvas.isText(r, c)) return;
    canvas.recast(r, c, BLANK_CELL);
    canvas.setStyle(r, c, DEFAULT_STYLE);
  };
  const rule = (r: number, c: number, glyph: string): void => {
    if (!edgeThroughRule(canvas, r, c, top, bottom, left, right)) block(r, c, glyph);
  };
  const [tl, tr, bl, br] = PILL_SHOULDERS;
  if (height === 2) {
    block(top, left, tl);
    block(top, right, tr);
    block(bottom, left, bl);
    block(bottom, right, br);
    return;
  }
  for (const c of [left, left + 1, right - 1, right]) {
    clear(top, c);
    clear(bottom, c);
  }
  rule(top, left + PILL_STEPS, PILL_END);
  rule(top, right - PILL_STEPS, PILL_END);
  for (let c = left + PILL_STEPS + 1; c < right - PILL_STEPS; c++) rule(top, c, SLAB_TOP);
  for (let c = left + PILL_STEPS; c <= right - PILL_STEPS; c++) rule(bottom, c, SLAB_BOTTOM);
  for (let r = top + 1; r < bottom; r++) {
    if (height >= 4 && r === top + 1) {
      clear(r, left);
      clear(r, right);
      block(r, left + 1, tl);
      block(r, right - 1, tr);
    } else if (height >= 4 && r === bottom - 1) {
      clear(r, left);
      clear(r, right);
      block(r, left + 1, bl);
      block(r, right - 1, br);
    } else {
      block(r, left, SLAB_LEFT);
      block(r, right, SLAB_RIGHT);
    }
  }
}
