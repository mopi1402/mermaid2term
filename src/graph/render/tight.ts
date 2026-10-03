import { Canvas, DEFAULT_STYLE } from "../../canvas/canvas.js";
import { DOWN_STROKES as RUN_DOWN, armsOf } from "../../canvas/alphabet.js";
import { HEAVY, LIGHT, NONE, weightedGlyph, type Weight } from "../../canvas/arms.js";
import { NodeShape } from "../shapes.js";
import { TightAxis } from "../layout/laid.js";
import { type CharSet } from "../../canvas/model.js";

import { BLANK_CELL, onAnEdge } from "../../canvas/cells.js";
import { MARK_TAIL, RIM_TAIL, WALL_TAIL } from "../../canvas/keys.js";
import { must } from "../../must.js";
import { PAD_RULES } from "../../canvas/pad-glyphs.js";

// Which cells of a padless outline carry the frame's own ground. A border inks ONE edge of its cell: pushed OUT,
// the other seven eighths lie INSIDE and the ground runs behind the line; pulled IN, they lie outside and the
// ground stops short. HORIZONTAL pushes the walls out and VERTICAL the rules, and a corner always takes the glyph
// of the pair pulled in, so it never carries the ground. A frame on whole glyphs inks the middle of its cell, and
// there every border stands on the ground.
export function groundedBorders(axis: TightAxis | undefined): { walls: boolean; rules: boolean; corners: boolean } {
  if (axis === undefined) return { walls: true, rules: true, corners: true };
  const horizontal = axis === TightAxis.HORIZONTAL;
  return { walls: horizontal, rules: !horizontal, corners: false };
}

// A CONTAINER's outline in the padless alphabet, on the form its own links choose (`tightAxes`), which is the form
// a box takes: pulled IN on the axis it is compact on and pushed OUT on the axis it spans. HORIZONTAL gives the
// corner cells to the rules and the walls the outer edge; VERTICAL gives them to the walls and the rules the outer
// edge. `doubled` gives the floor alone the heavy rule, which is what a composite state's `╘══╛` comes to here.
export function drawTightFrame(canvas: Canvas, top: number, bottom: number, left: number, right: number, key: string, doubled = false, vertical = false): void {
  const light = must(PAD_RULES.get(LIGHT));
  const heavy = must(PAD_RULES.get(HEAVY));
  const lid = vertical ? light[1] : light[0];
  const floor = doubled ? (vertical ? heavy[0] : heavy[1]) : vertical ? light[0] : light[1];
  const onTheLeft = vertical ? light[2] : light[3];
  const onTheRight = vertical ? light[3] : light[2];
  // What the container holds wins: an edge or a label crossing the outline keeps its cell and the frame shows the
  // notch, there being no eighth-block crossing to draw instead. A note's padding holds its cell too, being blank
  // but styled, so the frame reads the style as well as the glyph: the outline is what gives way, never the note.
  const lay = (r: number, c: number, glyph: string, style: string): void => {
    if (canvas.get(r, c) !== BLANK_CELL || canvas.getStyle(r, c) !== DEFAULT_STYLE) return;
    canvas.put(r, c, glyph, true, style);
  };
  // The corner cell belongs to whichever pair is pushed out: theirs is the run that reaches the box's own extreme.
  const firstColumn = vertical ? left + 1 : left;
  const lastColumn = vertical ? right - 1 : right;
  const firstRow = vertical ? top : top + 1;
  const lastRow = vertical ? bottom : bottom - 1;
  for (let c = firstColumn; c <= lastColumn; c++) {
    lay(top, c, lid, key);
    lay(bottom, c, floor, key);
  }
  // A border cell stands on the frame's own ground wherever its ink takes the cell's OUTER edge, the rest of the cell
  // then lying inside the frame. VERTICAL inks the walls on their INNER edge, so a wall's cell lies outside and keeps
  // the page; HORIZONTAL inks them outside, and the ground travels in the key, the cluster fill leaving them be.
  const wall = vertical ? key : `${key}${WALL_TAIL}`;
  for (let r = firstRow; r <= lastRow; r++) {
    lay(r, left, onTheLeft, wall);
    lay(r, right, onTheRight, wall);
  }
}

// A full-width rule INSIDE a box, once the borders move to the cell edges: the run becomes eighths and the two
// cells it ends on become the walls' own, the way every compartment line a box holds is drawn.
export function padRuleRow(canvas: Canvas, row: number, left: number, right: number, key: string): void {
  const rules = must(PAD_RULES.get(LIGHT));
  for (const [c, glyph] of [[left, rules[2]], [right, rules[3]]] as const) {
    if (armsOf(canvas.get(row, c)) !== undefined && !canvas.isText(row, c)) canvas.recast(row, c, glyph);
  }
  for (let c = left + 1; c < right; c++) {
    if (armsOf(canvas.get(row, c)) === undefined || canvas.isText(row, c)) continue;
    canvas.recast(row, c, rules[0]);
    canvas.setStyle(row, c, `${key}${RIM_TAIL}`);
  }
}



export const PADDED_SHAPES = new Set([
  NodeShape.RECTANGLE,
  NodeShape.ROUNDED,
  NodeShape.STADIUM,
  NodeShape.SUBROUTINE,
  NodeShape.CIRCLE,
  NodeShape.DOUBLE_CIRCLE,
  NodeShape.DIAMOND,
  NodeShape.ASYMMETRIC,
  NodeShape.PARALLELOGRAM,
  NodeShape.PARALLELOGRAM_ALT,
  NodeShape.TRAPEZOID,
  NodeShape.TRAPEZOID_ALT,
  NodeShape.BRACE_LEFT,
  NodeShape.BRACE_RIGHT,
  NodeShape.BRACES,
  NodeShape.DIVIDED_RECTANGLE,
  NodeShape.LINED_RECTANGLE,
  NodeShape.NOTCHED_RECTANGLE,
  NodeShape.NOTE,
]);

export function nameMarks(cs: CharSet, shape: NodeShape): readonly [onRule: string, mark: string] | undefined {
  if (shape === NodeShape.DIAMOND) return [cs.diamondTop, cs.diamondFilled];
  if (shape === NodeShape.CIRCLE) return [cs.circleMark, cs.circleMarkFilled];
  if (shape === NodeShape.DOUBLE_CIRCLE) return [cs.doubleCircleMark, cs.doubleCircleMark];
  return undefined;
}

export function unmarkRules(canvas: Canvas, top: number, bottom: number, left: number, right: number, onRule: string): void {
  for (const [row, outer, stub] of [[top, top - 1, 2], [bottom, bottom + 1, 3]] as const) {
    for (let c = left + 1; c < right; c++) {
      if (canvas.get(row, c) !== onRule) continue;
      const beside = armsOf(canvas.get(row, c === left + 1 ? c + 1 : c - 1));
      const weight = beside === undefined || beside[0] === NONE ? LIGHT : beside[0];
      const stroke = armsOf(canvas.get(outer, c));
      const out = stroke !== undefined && RUN_DOWN.has(canvas.get(outer, c)) && onAnEdge(canvas.getStyle(outer, c)) ? stroke[stub] : NONE;
      const arms: [Weight, Weight, Weight, Weight] = [weight, weight, NONE, NONE];
      arms[stub] = out;
      canvas.recast(row, c, weightedGlyph(arms) ?? canvas.get(row, c));
    }
  }
}

export function padNameMarks(canvas: Canvas, top: number, bottom: number, left: number, right: number, key: string, mark: string, wallsHug: boolean): void {
  const lines: number[] = [];
  for (let r = top + 1; r < bottom; r++) {
    for (let c = left + 1; c < right; c++) {
      if (canvas.isText(r, c)) {
        lines.push(r);
        break;
      }
    }
  }
  const row = lines[Math.floor((lines.length - 1) / 2)];
  if (row === undefined) return;
  let first = -1;
  let last = -1;
  for (let c = left + 1; c < right; c++) {
    if (!canvas.isText(row, c)) continue;
    if (first < 0) first = c;
    last = c;
  }
  const blanks = (from: number, step: number): number => {
    let n = 0;
    for (let c = from; c > left && c < right && canvas.get(row, c) === BLANK_CELL && !canvas.isText(row, c); c += step) n++;
    return n;
  };
  const room = Math.min(blanks(first - 1, -1), blanks(last + 1, 1));
  if (room < 1) return;
  const gap = room >= (wallsHug ? 3 : 2) ? 2 : 1;
  for (const c of [first - gap, last + gap]) {
    canvas.recast(row, c, mark);
    canvas.setStyle(row, c, `${key}${MARK_TAIL}`);
  }
}

export const INNER_LINES: ReadonlyMap<NodeShape, ReadonlyArray<readonly [inset: number, side: 2 | 3]>> = new Map([
  [NodeShape.SUBROUTINE, [[1, 2], [-1, 3]]],
  [NodeShape.LINED_RECTANGLE, [[1, 2]]],
]);

export function padInnerLines(canvas: Canvas, top: number, bottom: number, left: number, right: number, key: string, lines: ReadonlyArray<readonly [number, 2 | 3]>): void {
  if (right - left < 4) return;
  for (let r = top + 1; r < bottom; r++) {
    for (const [inset, side] of lines) {
      const c = inset > 0 ? left + inset : right + inset;
      const arms = armsOf(canvas.get(r, c));
      if (arms === undefined || canvas.isText(r, c)) continue;
      const [l, rt, u, d] = arms;
      if (l !== NONE || rt !== NONE || u !== d) continue;
      const rules = PAD_RULES.get(u);
      if (rules === undefined) continue;
      canvas.recast(r, c, rules[side]);
      canvas.setStyle(r, c, `${key}${RIM_TAIL}`);
    }
  }
}

