import { Canvas, DEFAULT_STYLE } from "../../canvas/canvas.js";
import { ACROSS_STROKES as RUN_ACROSS, BLOCK, BOX, DOWN_STROKES as RUN_DOWN, armsOf } from "../../canvas/alphabet.js";
import { HEAVY, LIGHT, NONE, weightedGlyph, type Weight } from "../../canvas/arms.js";

import { NodeShape } from "../shapes.js";

import { ARROWHEADS, BLANK_CELL, columnFree, headOutside, isFree, onAnEdge, rowFree } from "../../canvas/cells.js";
import { PAD_RULES, RULE_WEIGHTS } from "../../canvas/pad-glyphs.js";

import { must } from "../../must.js";
import { EDGE as STYLE_EDGE, RIM_TAIL } from "../../canvas/keys.js";
const RETREAT_CORNERS: Readonly<Record<"left" | "right", readonly [string, string]>> = {
  left: [BLOCK.lessUpperRight, BLOCK.lessLowerRight],
  right: [BLOCK.lessUpperLeft, BLOCK.lessLowerLeft],
};

function advanceHead(canvas: Canvas, r: number, c: number, hr: number, hc: number, along: boolean): void {
  const head = canvas.get(r, c);
  const headKey = canvas.getStyle(r, c);
  const [br, bc] = [r + (r - hr), c + (c - hc)];
  const behind = canvas.get(br, bc);
  const behindKey = canvas.getStyle(br, bc);
  const strokes = along ? RUN_ACROSS : RUN_DOWN;
  let stroke = strokes.has(behind) ? behind : undefined;
  if (stroke === undefined) {
    const arms = armsOf(behind);
    const w = arms === undefined ? LIGHT : along ? (bc > c ? arms[0] : arms[1]) : br > r ? arms[2] : arms[3];
    const weight = w === NONE ? LIGHT : w;
    stroke = weightedGlyph(along ? [weight, weight, NONE, NONE] : [NONE, NONE, weight, weight]) ?? (along ? BOX.across : BOX.down);
  }
  canvas.recast(hr, hc, head);
  canvas.setStyle(hr, hc, headKey);
  canvas.recast(r, c, stroke);
  canvas.setStyle(r, c, onAnEdge(behindKey) ? behindKey : STYLE_EDGE);
}

const ROW_RETREAT_CORNERS: Readonly<Record<"top" | "bottom", readonly [string, string]>> = {
  top: [BLOCK.lessLowerLeft, BLOCK.lessLowerRight],
  bottom: [BLOCK.lessUpperLeft, BLOCK.lessUpperRight],
};

const ROWS_RETREAT_SHAPES = new Set([
  NodeShape.RECTANGLE,
  NodeShape.ROUNDED,
  NodeShape.NOTCHED_RECTANGLE,
  NodeShape.DIAMOND,
  NodeShape.CIRCLE,
  NodeShape.DOUBLE_CIRCLE,
]);

type Side = "left" | "right" | "top" | "bottom";

type Attachments = Record<Side, number[]>;

// A border cell holds an edge when its rule meets a head just outside, or when the edge's own run or head sits on it.
function attachedAt(canvas: Canvas, r: number, c: number, outerR: number, outerC: number, runs: ReadonlySet<string>): boolean {
  const ch = canvas.get(r, c);
  return RULE_WEIGHTS.has(ch) ? headOutside(canvas, outerR, outerC) : (runs.has(ch) || ARROWHEADS.has(ch)) && onAnEdge(canvas.getStyle(r, c));
}

function attachmentsOf(canvas: Canvas, top: number, bottom: number, left: number, right: number): Attachments {
  const found: Attachments = { left: [], right: [], top: [], bottom: [] };
  for (const side of ["left", "right"] as const) {
    const wall = side === "left" ? left : right;
    const outer = side === "left" ? left - 1 : right + 1;
    for (let r = top + 1; r < bottom; r++) if (attachedAt(canvas, r, wall, r, outer, RUN_ACROSS)) found[side].push(r);
  }
  for (const side of ["top", "bottom"] as const) {
    const row = side === "top" ? top : bottom;
    const outer = side === "top" ? top - 1 : bottom + 1;
    for (let c = left + 1; c < right; c++) if (attachedAt(canvas, row, c, outer, c, RUN_DOWN)) found[side].push(c);
  }
  return found;
}

function frameWeight(canvas: Canvas, top: number, bottom: number, left: number, right: number): Weight {
  for (let r = top; r <= bottom; r++) {
    for (const c of r === top || r === bottom ? Array.from({ length: right - left - 1 }, (_, i) => left + 1 + i) : [left, right]) {
      const w = RULE_WEIGHTS.get(canvas.get(r, c));
      if (w !== undefined) return w;
    }
  }
  return NONE;
}

const clearWall = (canvas: Canvas, r: number, wall: number): void => {
  if (!RULE_WEIGHTS.has(canvas.get(r, wall))) return;
  canvas.recast(r, wall, BLANK_CELL);
  canvas.setStyle(r, wall, DEFAULT_STYLE);
};

export function retreatBorders(canvas: Canvas, top: number, bottom: number, left: number, right: number, key: string, shape: NodeShape, rounded: boolean): void {
  const att = attachmentsOf(canvas, top, bottom, left, right);
  const across = att.left.length + att.right.length;
  const along = att.top.length + att.bottom.length;
  if (across + along === 0) return;
  const weight = frameWeight(canvas, top, bottom, left, right);
  const rules = PAD_RULES.get(weight);
  if (rules === undefined) return;
  const rim = `${key}${RIM_TAIL}`;
  const wallFree = {
    left: shape !== NodeShape.ASYMMETRIC && left + 1 < right && columnFree(canvas, top, bottom, left + 1),
    right: right - 1 > left && columnFree(canvas, top, bottom, right - 1),
  };
  const tall = bottom - top >= 3;
  const ruleFree = {
    top: tall && ROWS_RETREAT_SHAPES.has(shape) && rowFree(canvas, top + 1, left, right),
    bottom: tall && ROWS_RETREAT_SHAPES.has(shape) && rowFree(canvas, bottom - 1, left, right),
  };

  const wallSteps = (att.left.length && !wallFree.left ? att.left.length : 0) + (att.right.length && !wallFree.right ? att.right.length : 0);
  const stepsIfWalls = along + wallSteps;
  const takenRows = new Set<number>([...(ruleFree.top ? [top + 1] : []), ...(ruleFree.bottom ? [bottom - 1] : [])]);
  const rowsPossible =
    (ruleFree.top || ruleFree.bottom) &&
    along > 0 &&
    (["left", "right"] as const).every((side) =>
      att[side].every((r) => !takenRows.has(r) && isFree(canvas, r, side === "left" ? left + 1 : right - 1))
    );
  const stepsIfRows = across + (ruleFree.top ? 0 : att.top.length) + (ruleFree.bottom ? 0 : att.bottom.length);
  const retreatRows = rowsPossible && stepsIfRows < stepsIfWalls;

  if (retreatRows) {
    for (const side of ["top", "bottom"] as const) {
      if (!ruleFree[side]) continue;
      const row = side === "top" ? top : bottom;
      const inner = side === "top" ? top + 1 : bottom - 1;
      const outer = side === "top" ? top - 1 : bottom + 1;
      for (let c = left; c <= right; c++) {
        const ch = canvas.get(row, c);
        if (ch === BLANK_CELL || canvas.isText(row, c) || onAnEdge(canvas.getStyle(row, c))) continue;
        canvas.recast(row, c, BLANK_CELL);
        canvas.setStyle(row, c, DEFAULT_STYLE);
      }
      for (let c = left + 1; c < right; c++) {
        canvas.recast(inner, c, side === "top" ? rules[1] : rules[0]);
        canvas.setStyle(inner, c, rim);
      }
      if (weight === HEAVY && !rounded) {
        canvas.recast(inner, left, ROW_RETREAT_CORNERS[side][0]);
        canvas.recast(inner, right, ROW_RETREAT_CORNERS[side][1]);
      }
      for (const c of att[side]) if (canvas.get(row, c) === BLANK_CELL && headOutside(canvas, outer, c)) advanceHead(canvas, outer, c, row, c, false);
    }
    for (const side of ["left", "right"] as const) {
      const wall = side === "left" ? left : right;
      const inner = side === "left" ? left + 1 : right - 1;
      const outer = side === "left" ? left - 1 : right + 1;
      for (const r of att[side]) {
        clearWall(canvas, r, wall);
        canvas.recast(r, inner, side === "left" ? rules[3] : rules[2]);
        canvas.setStyle(r, inner, rim);
        if (headOutside(canvas, r, outer) && canvas.get(r, wall) === BLANK_CELL) advanceHead(canvas, r, outer, r, wall, true);
      }
    }
  } else {
    if (across > 0) {
      for (const side of ["left", "right"] as const) {
        if (!wallFree[side]) continue;
        const wall = side === "left" ? left : right;
        const inner = side === "left" ? left + 1 : right - 1;
        const outer = side === "left" ? left - 1 : right + 1;
        const glyph = side === "left" ? rules[3] : rules[2];
        for (let r = top + 1; r < bottom; r++) {
          clearWall(canvas, r, wall);
          canvas.recast(r, inner, glyph);
          canvas.setStyle(r, inner, rim);
        }
        for (const r of att[side]) if (headOutside(canvas, r, outer) && canvas.get(r, wall) === BLANK_CELL) advanceHead(canvas, r, outer, r, wall, true);
        if (weight === HEAVY) {
          for (const [row, at] of [[top, 0], [bottom, 1]] as const) {
            const corner = canvas.get(row, wall);
            if (RULE_WEIGHTS.get(corner) === undefined && corner !== BLANK_CELL) {
              canvas.recast(row, wall, BLANK_CELL);
              canvas.setStyle(row, wall, DEFAULT_STYLE);
            }
            if (!rounded && canvas.get(row, inner) === (row === top ? rules[0] : rules[1])) canvas.recast(row, inner, RETREAT_CORNERS[side][at]);
          }
        }
      }
    }
  }
  for (const side of ["top", "bottom"] as const) {
    if (retreatRows && ruleFree[side]) continue;
    const row = side === "top" ? top : bottom;
    const inner = side === "top" ? top + 1 : bottom - 1;
    const outer = side === "top" ? top - 1 : bottom + 1;
    for (const c of att[side]) {
      const arrival = RULE_WEIGHTS.has(canvas.get(row, c)) && headOutside(canvas, outer, c);
      if (inner < bottom && inner > top && isFree(canvas, inner, c)) {
        canvas.recast(inner, c, side === "top" ? rules[1] : rules[0]);
        canvas.setStyle(inner, c, rim);
      }
      if (arrival) advanceHead(canvas, outer, c, row, c, false);
    }
  }
}

export function padSubroutine(canvas: Canvas, top: number, bottom: number, left: number, right: number, key: string): void {
  if (right - left < 5) return;
  const rim = `${key}${RIM_TAIL}`;
  let weight: Weight = NONE;
  for (let r = top + 1; r < bottom; r++) {
    const w = RULE_WEIGHTS.get(canvas.get(r, left)) ?? RULE_WEIGHTS.get(canvas.get(r, right));
    if (w !== undefined) weight = w;
    if (!isFree(canvas, r, left + 2) || !isFree(canvas, r, right - 2)) return;
  }
  if (weight === NONE) return;
  const rules = must(PAD_RULES.get(weight));
  for (const side of ["left", "right"] as const) {
    const wall = side === "left" ? left : right;
    const step = side === "left" ? 1 : -1;
    const glyph = side === "left" ? rules[3] : rules[2];
    for (let r = top + 1; r < bottom; r++) {
      clearWall(canvas, r, wall);
      for (const c of [wall + step, wall + 2 * step]) {
        canvas.recast(r, c, glyph);
        canvas.setStyle(r, c, rim);
      }
      const outer = wall - step;
      if (canvas.get(r, wall) === BLANK_CELL && ARROWHEADS.has(canvas.get(r, outer)) && onAnEdge(canvas.getStyle(r, outer))) {
        advanceHead(canvas, r, outer, r, wall, true);
      }
    }
    if (weight === HEAVY) {
      for (const [row, at] of [[top, 0], [bottom, 1]] as const) {
        canvas.recast(row, wall, BLANK_CELL);
        canvas.setStyle(row, wall, DEFAULT_STYLE);
        canvas.recast(row, wall + step, RETREAT_CORNERS[side][at]);
      }
    }
  }
}
