import { Canvas, DEFAULT_STYLE } from "./canvas.js";
import { ARCS, BLOCK, BOX, DOWN_STROKES as RUN_DOWN, armsOf } from "./alphabet.js";
import { HEAVY, LIGHT, NONE, heaviest, weightedGlyph } from "./arms.js";

import { ARROWHEADS, BLANK_CELL, FULL_BLOCK, edgeKeyOutside, edgeStrokeOutside, isFree, onAnEdge } from "./cells.js";
import { PAD_ROUND_CORNERS, PAD_RULES } from "./pad-glyphs.js";

import { ARROW, EDGE as STYLE_EDGE, RIM_TAIL } from "./keys.js";
import { SPACE } from "../text/chars.js";
import { layBand } from "./band.js";
import type { Edges } from "./extent.js";

import { must } from "../must.js";
import { HEAVY_DASH_DOWN, LIGHT_DASH_DOWN } from "./strokes.js";

const DASHED_WALLS: ReadonlySet<string> = new Set([...LIGHT_DASH_DOWN.slice(1), ...HEAVY_DASH_DOWN.slice(1)]);

// A dashed outline has no eighth of its own to move to, so it keeps the box alphabet, as a dashed box does.
const dashedWalls = (canvas: Canvas, top: number, bottom: number, left: number, right: number): boolean => {
  for (let r = top + 1; r < bottom; r++) if (DASHED_WALLS.has(canvas.get(r, left)) || DASHED_WALLS.has(canvas.get(r, right))) return true;
  return false;
};
// A quadrant arc ends its curve on the OUTER edge of its cell, so a rounded box has to run its whole outline
// there too: a rule or a wall laid on the inner edge stands a cell away from the corner and the ink breaks.
const outerWall = (rules: readonly [string, string, string, string], atLeft: boolean, rounded: boolean): string =>
  atLeft === rounded ? rules[3] : rules[2];

const outerRule = (rules: readonly [string, string, string, string], atTop: boolean, rounded: boolean): string =>
  atTop === rounded ? rules[1] : rules[0];

// Every inked cell of the outline, read as the walk reaches it so an earlier rewrite shows.
function* inkedOutline(canvas: Canvas, top: number, bottom: number, left: number, right: number): Generator<{ r: number; c: number; ch: string; onRule: boolean; onWall: boolean }> {
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      const onRule = r === top || r === bottom;
      const onWall = c === left || c === right;
      if (!onRule && !onWall) continue;
      const ch = canvas.get(r, c);
      if (ch !== BLANK_CELL && !canvas.isText(r, c)) yield { r, c, ch, onRule, onWall };
    }
  }
}

export function tightenFrame(canvas: Canvas, top: number, bottom: number, left: number, right: number, key: string, rounded: boolean): void {
  for (const { r, c, ch, onRule, onWall } of inkedOutline(canvas, top, bottom, left, right)) {
    const rules = must(PAD_RULES.get(LIGHT));
    const rim = `${key}${RIM_TAIL}`;
    if (onWall && !onRule && ARROWHEADS.has(ch)) {
      const ci = c === left ? c + 1 : c - 1;
      if (ci < right && ci > left && canvas.get(r, ci) === BLANK_CELL && !canvas.isText(r, ci)) {
        canvas.recast(r, ci, c === left ? rules[3] : rules[2]);
        canvas.setStyle(r, ci, rim);
      }
      continue;
    }
    const arms = armsOf(ch);
    if (onRule && onWall) {
      const weight = ARCS.has(ch) ? LIGHT : heaviest(arms ?? [NONE]);
      if (weight === NONE) continue;
      if (rounded) {
        canvas.recast(r, c, PAD_ROUND_CORNERS[(r === top ? 0 : 2) + (c === left ? 0 : 1)]);
        canvas.setStyle(r, c, rim);
        continue;
      }
      if (weight === HEAVY) {
        canvas.recast(r, c, FULL_BLOCK);
        continue;
      }
      canvas.recast(r, c, c === left ? rules[2] : rules[3]);
      continue;
    }
    if (arms === undefined) continue;
    const [l, rt, u, d] = arms;
    const along = heaviest(onRule ? [l, rt] : [u, d]);
    const weighted = PAD_RULES.get(along);
    if (weighted === undefined) continue;
    if (onRule) {
      canvas.recast(r, c, r === top ? weighted[1] : weighted[0]);
      canvas.setStyle(r, c, rim);
      continue;
    }
    const stub = c === left ? l : rt;
    if (stub !== NONE) {
      // A ROUNDED box inks the OUTER edge of its wall column, so the run beside it already touches the outline and
      // the wall keeps its column. A SQUARE one inks the inner edge: the run takes that column and the wall steps to
      // the neighbouring cell's far edge, which is the same vertical line, so the ink meets the run with no jog.
      const stroke = weightedGlyph([stub, stub, NONE, NONE]);
      if (stroke === undefined) continue;
      const ci = c === left ? c + 1 : c - 1;
      if (rounded || !(ci > left && ci < right && canvas.get(r, ci) === BLANK_CELL && !canvas.isText(r, ci))) {
        canvas.recast(r, c, outerWall(weighted, c === left, rounded));
        if (rounded) canvas.setStyle(r, c, rim);
        continue;
      }
      canvas.recast(r, c, edgeStrokeOutside(canvas, r, c, top, bottom, left, right, stroke));
      canvas.setStyle(r, c, edgeKeyOutside(canvas, r, c, top, bottom, left, right));
      canvas.recast(r, ci, c === left ? weighted[3] : weighted[2]);
      canvas.setStyle(r, ci, rim);
      continue;
    }
    canvas.recast(r, c, along === HEAVY ? FULL_BLOCK : outerWall(weighted, c === left, rounded));
    if (rounded && along !== HEAVY) canvas.setStyle(r, c, rim);
  }
}

// The tail that leaves a moved outline its own key, for a box whose cells already stand on their ground or lay none.
export const OWN_KEY = "";

export function widenFrame(canvas: Canvas, top: number, bottom: number, left: number, right: number, key: string, rounded: boolean, tail = RIM_TAIL): void {
  if (dashedWalls(canvas, top, bottom, left, right)) return;
  const rules = must(PAD_RULES.get(LIGHT));
  const rim = `${key}${tail}`;
  // Two rows of wall are enough to hold the four arcs, one pair each, and then the box keeps the rectangle's own
  // rules: the curve ends where they already run. Below that the arcs go back to the corner cell of the rule row,
  // which only meets them on the outer edge.
  const cornersInside = rounded && bottom - top >= 3;
  const outerInk = rounded && !cornersInside;
  const stepInside = (r: number, c: number, weighted: readonly [string, string, string, string]): void => {
    const ri = r === top ? r + 1 : r - 1;
    if (ri <= top || ri >= bottom || !isFree(canvas, ri, c)) return;
    canvas.recast(ri, c, r === top ? weighted[1] : weighted[0]);
    canvas.setStyle(ri, c, rim);
  };
  for (const { r, c, ch, onRule, onWall } of inkedOutline(canvas, top, bottom, left, right)) {
    if (ARROWHEADS.has(ch)) {
      if (onRule && !onWall) stepInside(r, c, rules);
      continue;
    }
    const arms = armsOf(ch);
    if (onRule && onWall) {
      const weight = ARCS.has(ch) ? LIGHT : heaviest(arms ?? [NONE]);
      const corners = PAD_RULES.get(weight);
      if (weight === NONE || corners === undefined) continue;
      if (cornersInside) {
        canvas.recast(r, c, BLANK_CELL);
        canvas.setStyle(r, c, DEFAULT_STYLE);
        continue;
      }
      if (outerInk) {
        canvas.recast(r, c, PAD_ROUND_CORNERS[(r === top ? 0 : 2) + (c === left ? 0 : 1)]);
        canvas.setStyle(r, c, rim);
        continue;
      }
      canvas.recast(r, c, r === top ? corners[0] : corners[1]);
      continue;
    }
    if (arms === undefined) continue;
    const [l, rt, u, d] = arms;
    const along = heaviest(onRule ? [l, rt] : [u, d]);
    const weighted = PAD_RULES.get(along);
    if (weighted === undefined) continue;
    if (onWall) {
      const curve = cornersInside && (r === top + 1 || r === bottom - 1);
      canvas.recast(r, c, curve ? PAD_ROUND_CORNERS[(r === top + 1 ? 0 : 2) + (c === left ? 0 : 1)] : c === left ? weighted[3] : weighted[2]);
      canvas.setStyle(r, c, rim);
      continue;
    }
    const stub = r === top ? u : d;
    if (stub !== NONE) {
      const stroke = weightedGlyph([NONE, NONE, stub, stub]);
      if (stroke === undefined) continue;
      canvas.recast(r, c, edgeStrokeOutside(canvas, r, c, top, bottom, left, right, stroke));
      canvas.setStyle(r, c, edgeKeyOutside(canvas, r, c, top, bottom, left, right));
      stepInside(r, c, weighted);
      continue;
    }
    canvas.recast(r, c, outerRule(weighted, r === top, outerInk));
    if (outerInk) canvas.setStyle(r, c, rim);
  }
}

// A box's border moved onto its cells' edges across the flow, a treemap leaf's or a kanban card's: its walls keep the
// box's ground and its rules, pulled in, stand outside it, the cells `owned` of them taking the parent's `outside` key.
export function widenBox(canvas: Canvas, edges: Edges, key: string, rounded: boolean, tail: string, owned: string, outside: string): void {
  const { top, bottom, left, right } = edges;
  widenFrame(canvas, top, bottom, left, right, key, rounded, tail);
  for (const row of [top, bottom]) for (let c = left; c <= right; c++) if (!canvas.isText(row, c) && canvas.getStyle(row, c) === owned) canvas.setStyle(row, c, outside);
}

export function closeUpTight(canvas: Canvas, top: number, bottom: number, left: number, right: number): [number, number] {
  let first = -1;
  let last = -1;
  for (let r = top + 1; r < bottom; r++) {
    for (let c = left + 1; c < right; c++) {
      if (!canvas.isText(r, c)) continue;
      if (first < 0) first = r;
      last = r;
      break;
    }
  }
  if (first < 0) return [top, bottom];
  for (let r = top + 1; r < bottom; r++) {
    if (!wallHolds(canvas, r, left, 0) && !wallHolds(canvas, r, right, 1)) continue;
    first = Math.min(first, r);
    last = Math.max(last, r);
  }
  const boxTop = Math.max(first - 1, top);
  const boxBottom = Math.min(last + 1, bottom);
  closeRule(canvas, top, boxTop, left, right, -1);
  closeRule(canvas, bottom, boxBottom, left, right, 1);
  return [boxTop, boxBottom];
}

function wallHolds(canvas: Canvas, r: number, c: number, out: 0 | 1): boolean {
  const ch = canvas.get(r, c);
  if (ARROWHEADS.has(ch)) return true;
  const arms = armsOf(ch);
  if (arms !== undefined && arms[out] !== NONE && arms[1 - out] === NONE) return true;
  const outer = out === 0 ? c - 1 : c + 1;
  return ARROWHEADS.has(canvas.get(r, outer)) && onAnEdge(canvas.getStyle(r, outer));
}

function closeRule(canvas: Canvas, from: number, to: number, left: number, right: number, outward: -1 | 1): void {
  if (from === to) return;
  for (let c = left; c <= right; c++) {
    const ch = canvas.get(from, c);
    canvas.recast(to, c, ch);
    canvas.setStyle(to, c, canvas.getStyle(from, c));
    const gap = canvas.get(from + outward, c);
    const gapStyle = canvas.getStyle(from + outward, c);
    const arms = armsOf(ch);
    const stub = arms === undefined || c === left || c === right ? NONE : arms[outward < 0 ? 2 : 3];
    if (stub !== NONE) {
      const stroke = RUN_DOWN.has(gap) ? gap : (weightedGlyph([NONE, NONE, stub, stub]) ?? BOX.down);
      for (let r = from; r !== to; r -= outward) {
        canvas.recast(r, c, stroke);
        canvas.setStyle(r, c, gapStyle);
      }
      continue;
    }
    if (c > left && c < right && ARROWHEADS.has(gap) && onAnEdge(gapStyle)) {
      const beyond = canvas.get(from + 2 * outward, c);
      const beyondArms = armsOf(beyond);
      const towards = beyondArms === undefined ? (ARCS.has(beyond) ? LIGHT : NONE) : beyondArms[outward < 0 ? 3 : 2];
      const stroke = RUN_DOWN.has(beyond) ? beyond : (weightedGlyph([NONE, NONE, towards, towards]) ?? BOX.down);
      const beyondStyle = canvas.getStyle(from + 2 * outward, c);
      const strokeStyle = onAnEdge(beyondStyle) ? beyondStyle : gapStyle === ARROW ? STYLE_EDGE : gapStyle;
      for (let r = from + outward; r !== to + outward; r -= outward) {
        canvas.recast(r, c, stroke);
        canvas.setStyle(r, c, strokeStyle);
      }
      canvas.recast(to + outward, c, gap);
      canvas.setStyle(to + outward, c, gapStyle);
      continue;
    }
    for (let r = from; r !== to; r -= outward) {
      canvas.recast(r, c, BLANK_CELL);
      canvas.setStyle(r, c, DEFAULT_STYLE);
    }
  }
}

// A compartment rule stands INSIDE the walls once the borders ride the cell edges: the wall then inks every row of
// the box, so a relation can land on any of them, and the rule reads as the band line it is rather than as another
// floor of the box. Too narrow a box keeps the rule it has, there being no room to pull it back.
const RULE_INSET = 4;

function insetRule(canvas: Canvas, row: number, left: number, right: number): void {
  if (right - left < RULE_INSET) return;
  canvas.clearChar(row, left + 1);
  canvas.clearChar(row, right - 1);
}

// A wall stepped into the rule's gap on the row a relation meets pushes the gap one cell further in.
function reopenRule(canvas: Canvas, row: number, left: number, right: number): void {
  if (right - left < RULE_INSET + 2) return;
  if (canvas.get(row, left + 1) !== SPACE) canvas.clearChar(row, left + 2);
  if (canvas.get(row, right - 1) !== SPACE) canvas.clearChar(row, right - 2);
}

// What a relation leaves on the wall's OWN cell: the mark already standing there, or the stroke stopped beside it,
// which then runs one cell further. A label, or a shaft passing by on its way somewhere else, leaves the wall be.
function takenBy(canvas: Canvas, row: number, wall: number, outside: number): readonly [string, string] | undefined {
  const mark = canvas.get(row, wall);
  if (mark !== SPACE && armsOf(mark) === undefined && onAnEdge(canvas.getStyle(row, wall))) {
    return [mark, canvas.getStyle(row, wall)];
  }
  const beside = canvas.get(row, outside);
  const arms = armsOf(beside);
  if (arms === undefined || !onAnEdge(canvas.getStyle(row, outside))) return undefined;
  const [left, right, up, down] = arms;
  // An arc turning INTO the wall, the claw of a crow's foot, meets it as a run would: the wall's cell takes its stroke.
  const toward = outside < wall ? right : left;
  const turning = ARCS.has(beside) ? weightedGlyph([toward, toward, NONE, NONE]) : undefined;
  if (turning !== undefined) return [turning, canvas.getStyle(row, outside)];
  if (up !== NONE || down !== NONE || left === NONE || right === NONE) return undefined;
  return [beside, canvas.getStyle(row, outside)];
}

// A wall inks ONE eighth of its own cell, the one facing the text, so a run stopping outside stands a whole cell
// of that wall's own from the ink and reads as unattached. On the row a relation meets, the wall STEPS one cell
// inside the box and inks the eighth facing out, which falls in the column the wall above and below inks, and the
// run takes the cell it leaves. Turning the wall where it stands would touch the run and jog the outline by a cell.
function faceTheRuns(canvas: Canvas, top: number, bottom: number, left: number, right: number, key: string): void {
  for (let row = top + 1; row < bottom; row++) {
    for (const [wall, step, facing] of [
      [left, 1, BLOCK.leftEighth],
      [right, -1, BLOCK.rightEighth],
    ] as const) {
      const inside = wall + step;
      const taken = takenBy(canvas, row, wall, wall - step);
      if (taken === undefined || canvas.isText(row, inside) || canvas.get(row, inside) !== SPACE) continue;
      // The stepped wall stands inside the box, its free part on the box's own ground, as `tightenFrame` steps one.
      canvas.recast(row, inside, facing);
      canvas.setStyle(row, inside, `${key}${RIM_TAIL}`);
      canvas.recast(row, wall, taken[0]);
      canvas.setStyle(row, wall, taken[1]);
    }
  }
}

// The wall cells a relation leaves through, a text standing on the cell inside so that the wall cannot step into it.
function wallsWithNoRoom(canvas: Canvas, top: number, bottom: number, left: number, right: number): Array<[number, number, boolean]> {
  const stuck: Array<[number, number, boolean]> = [];
  for (let row = top + 1; row < bottom; row++) {
    for (const [wall, step, arm] of [
      [left, 1, 0],
      [right, -1, 1],
    ] as const) {
      const stub = armsOf(canvas.get(row, wall))?.[arm] ?? NONE;
      const inside = wall + step;
      if (stub !== NONE && (canvas.isText(row, inside) || canvas.get(row, inside) !== SPACE)) stuck.push([row, wall, wall === left]);
    }
  }
  return stuck;
}

// A padless wall turned to face out where it stands, the half or eighth on its cell's outer edge.
export const joggedOut = (glyph: string, atLeft: boolean): boolean =>
  [...PAD_RULES.values()].some((rules) => glyph === (atLeft ? rules[3] : rules[2]));

// A box's ground, one band or one per row, kept inside its walls under padless save where a wall jogged out to meet a
// relation: that wall's free part lies inside the box.
export function layBoxBand(canvas: Canvas, top: number, bottom: number, left: number, right: number, band: string | ((row: number) => string), padless: boolean): void {
  for (let r = top; r <= bottom; r++) {
    const from = padless && !joggedOut(canvas.get(r, left), true) ? left + 1 : left;
    const to = padless && !joggedOut(canvas.get(r, right), false) ? right - 1 : right;
    layBand(canvas, r, r, from, to, typeof band === "string" ? band : band(r));
  }
}

export interface PaddedBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  // The rows of the rules drawn across it.
  readonly rules: readonly number[];
  readonly dashed: boolean;
}

// Each box's border moved onto the cell edges. A dashed outline has no eighth of its own to move to, so it keeps the
// box alphabet, as it does in the engine.
export function padBoxes(canvas: Canvas, boxes: Iterable<PaddedBox>): void {
  for (const box of boxes) if (!box.dashed) fitBox(canvas, box.y, box.y + box.h - 1, box.x, box.x + box.w - 1, box.rules);
}

// A box's border moved onto the edge of its cells, its rules pulled inside the walls and each wall facing the runs
// that meet it. The outline FIRST: it is what weighs the wall cells a rule ends on, a thick box closing them on full
// blocks where a plain one closes them on eighths. The rules pulled in before it, so a relation met on a rule's row
// finds the cell the wall steps into free.
function fitBox(canvas: Canvas, top: number, bottom: number, left: number, right: number, rules: readonly number[]): void {
  const key = canvas.getStyle(top, left);
  for (const rule of rules) insetRule(canvas, rule, left, right);
  const stuck = wallsWithNoRoom(canvas, top, bottom, left, right);
  tightenFrame(canvas, top, bottom, left, right, key, false);
  // With no cell to step into, the wall turns its ink out where it stands: a jog of one cell, the relation touching.
  for (const [row, wall, atLeft] of stuck) {
    const turned = [...PAD_RULES.values()].find((rules) => canvas.get(row, wall) === (atLeft ? rules[2] : rules[3]));
    if (turned !== undefined) canvas.recast(row, wall, atLeft ? turned[3] : turned[2]);
  }
  faceTheRuns(canvas, top, bottom, left, right, key);
  for (const rule of rules) reopenRule(canvas, rule, left, right);
}
