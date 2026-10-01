import { labelRowsOf, LITERAL_NEWLINE } from "../text/labels.js";
import { NEWLINE, SPACE } from "../text/chars.js";
import { centredAt, centredOffset, displayWidth } from "../text/width.js";
import type { Canvas } from "./canvas.js";
import type { CharSet } from "./model.js";
import { must } from "../must.js";
import { clusterCornersOf } from "./corners.js";
import {LABEL, OUT_TAIL, RIM_TAIL } from "./keys.js";

export type ShapeRenderer = (
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  cs: CharSet,
  style?: string,
  labelStyle?: string
) => void;

export const LABEL_STYLE = LABEL;

export const FOLD_ROWS = 3;

export const ROUND_LEFT = "(";

export const ROUND_RIGHT = ")";

export function drawLabel(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  style = "",
  labelKey?: string
): void {
  const labelStyle = labelKey ?? (style !== "" ? LABEL_STYLE : "");
  const lines = labelRowsOf(label, label.includes(NEWLINE) ? NEWLINE : LITERAL_NEWLINE);
  putCentredLines(canvas, y + centredOffset(height, lines.length), x, width, lines, labelStyle);
}

// One line per row from `top`, each centred in the `width` cells from `x`.
export function putCentredLines(canvas: Canvas, top: number, x: number, width: number, lines: readonly string[], key: string): void {
  lines.forEach((line, i) => {
    const row = top + i;
    if (row >= 0 && row < canvas.height) canvas.putText(row, x + centredAt(width, line), line, key);
  });
}

// What a ring may change of the box's own: its top and bottom rules, whether it draws its walls, whether it merges.
export interface Ring {
  readonly rules?: readonly [top: string, bottom: string];
  readonly walls?: boolean;
  readonly merge?: boolean;
}

export function frame(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  cs: CharSet,
  style: string,
  corners: readonly [string, string, string, string],
  sides: readonly [string, string] = [cs.vertical, cs.vertical],
  { rules = [cs.horizontal, cs.horizontal], walls = true, merge = true }: Ring = {}
): void {
  const [topLeft, topRight, bottomLeft, bottomRight] = corners;
  canvas.put(y, x, topLeft, merge, style);
  canvas.put(y, x + width - 1, topRight, merge, style);
  canvas.put(y + height - 1, x, bottomLeft, merge, style);
  canvas.put(y + height - 1, x + width - 1, bottomRight, merge, style);
  for (let c = x + 1; c < x + width - 1; c++) {
    canvas.put(y, c, rules[0], merge, style);
    canvas.put(y + height - 1, c, rules[1], merge, style);
  }
  if (!walls) return;
  for (let r = y + 1; r < y + height - 1; r++) {
    canvas.put(r, x, sides[0], merge, style);
    canvas.put(r, x + width - 1, sides[1], merge, style);
  }
}

// A subgraph's frame, on the cluster's own glyphs.
export function clusterFrame(canvas: Canvas, x: number, y: number, width: number, height: number, cs: CharSet, style: string): void {
  frame(canvas, x, y, width, height, cs, style, clusterCornersOf(cs), [cs.sgVertical, cs.sgVertical], { rules: [cs.sgHorizontal, cs.sgHorizontal] });
}

// A rule across a box from wall to wall, its two ends standing on the walls.
export function dividerRow(
  canvas: Canvas,
  row: number,
  x: number,
  width: number,
  style: string,
  [left, right]: readonly [string, string],
  across: string,
  acrossStyle = style
): void {
  canvas.put(row, x, left, true, style);
  canvas.putRow(row, x + 1, x + width - 1, across, true, acrossStyle);
  canvas.put(row, x + width - 1, right, true, style);
}

export function drawSunkLabel(
  canvas: Canvas,
  x: number,
  bodyTop: number,
  width: number,
  bodyRows: number,
  label: string,
  style: string,
  labelStyle?: string
): void {
  const sunk = bodyRows > 1 ? 1 : 0;
  drawLabel(canvas, x, bodyTop + sunk, width, bodyRows - sunk, label, style, labelStyle);
}

export const outside = (style: string): string => (style === "" ? style : `${style}${OUT_TAIL}`);

export const onFill = (style: string): string => (style === "" ? style : `${style}${RIM_TAIL}`);

// Each cell inside a shape's outline, blank or text, reached from its middle without crossing a line; a glyph
// `through` says stands on the shape's own ground is crossed as a blank is, and an outline moved off the middle of
// its rectangle is reached from `from`, a cell it holds.
const NONE_THROUGH = (): boolean => false;
export function floodInterior(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  visit: (r: number, c: number, blank: boolean) => void,
  through: (r: number, c: number) => boolean = NONE_THROUGH,
  from: readonly [row: number, col: number] = [y + Math.floor(height / 2), x + Math.floor(width / 2)]
): void {
  const [startRow, startCol] = from;
  const seen = new Set<number>();
  const queue: Array<readonly [number, number]> = [[startRow, startCol]];
  while (queue.length > 0) {
    const [r, c] = must(queue.pop());
    if (r <= y || r >= y + height - 1 || c <= x || c >= x + width - 1) continue;
    const at = r * canvas.width + c;
    if (seen.has(at)) continue;
    seen.add(at);
    const blank = canvas.get(r, c) === SPACE;
    if (!blank && !canvas.isText(r, c) && !through(r, c)) continue;
    visit(r, c, blank);
    queue.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
  }
}

export function fillInterior(canvas: Canvas, x: number, y: number, width: number, height: number, key: string, through: (r: number, c: number) => boolean = NONE_THROUGH): void {
  floodInterior(canvas, x, y, width, height, (r, c, blank) => {
    if (blank) canvas.setStyle(r, c, key);
  }, through);
}

export function marked(pick: (cs: CharSet) => string): ShapeRenderer {
  return (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
    const axis = x + Math.floor(width / 2);
    const middle = y + Math.floor(height / 2);
    canvas.put(middle, axis, pick(cs), false, style);
    if (label === "") return;
    const key = labelStyle ?? (style !== "" ? LABEL_STYLE : "");
    const lines = labelRowsOf(label);
    lines.forEach((line, i) => {
      const row = middle + 1 + i;
      const col = x + centredAt(width, line);
      canvas.putText(row, col, line, key);
      if (style === "") return;
      for (let c = col - 1; c <= col + displayWidth(line); c++) {
        if (canvas.get(row, c) === SPACE) canvas.setStyle(row, c, onFill(style));
      }
    });
  };
}
