import { Canvas } from "./canvas.js";
import { ACROSS_STROKES as RUN_ACROSS, BLOCK, DOWN_STROKES as RUN_DOWN, stubOf } from "./alphabet.js";
import { CHARSETS } from "./charsets.js";
import { ARROW, EDGE as STYLE_EDGE, EDGE_HEAD, LINK_STYLE_PREFIX, inkApart } from "./keys.js";
import { SPACE } from "../text/chars.js";
export type Point = readonly [number, number];

export type PlacedLabel = readonly [number, number, number];

export const BLANK_CELL = SPACE;

export const isFree = (canvas: Canvas, r: number, c: number): boolean => canvas.get(r, c) === BLANK_CELL && !canvas.isText(r, c);

export const headOutside = (canvas: Canvas, r: number, c: number): boolean => ARROWHEADS.has(canvas.get(r, c)) && onAnEdge(canvas.getStyle(r, c));

export const columnFree = (canvas: Canvas, top: number, bottom: number, c: number): boolean => {
  for (let r = top + 1; r < bottom; r++) if (!isFree(canvas, r, c)) return false;
  return true;
};

// Every cell of a `height` by `width` rectangle from `top`, `left` blank, a bare space unless `blank` says otherwise.
export function rectFree(canvas: Canvas, top: number, left: number, height: number, width: number, blank = (r: number, c: number): boolean => canvas.get(r, c) === BLANK_CELL): boolean {
  for (let r = top; r < top + height; r++) for (let c = left; c < left + width; c++) if (!blank(r, c)) return false;
  return true;
}

// Every cell of a `height` by `width` rectangle from `top`, `left` cleared; nothing where either is not positive.
export function clearRect(canvas: Canvas, top: number, left: number, height: number, width: number): void {
  for (let r = top; r < top + height; r++) for (let c = left; c < left + width; c++) canvas.clearChar(r, c);
}

// Every blank cell of a `height` by `width` rectangle from `top`, `left` keyed `key`.
export function keyBlanks(canvas: Canvas, top: number, left: number, height: number, width: number, key: string): void {
  for (let r = top; r < top + height; r++) for (let c = left; c < left + width; c++) if (canvas.get(r, c) === BLANK_CELL) canvas.setStyle(r, c, key);
}

export const rowFree = (canvas: Canvas, r: number, left: number, right: number): boolean => {
  for (let c = left + 1; c < right; c++) if (!isFree(canvas, r, c)) return false;
  return true;
};

export const FULL_BLOCK = BLOCK.full;

export function edgeKeyOutside(canvas: Canvas, r: number, c: number, top: number, bottom: number, left: number, right: number): string {
  const [nr, nc] = cellOutside(r, c, top, bottom, left, right);
  const key = canvas.getStyle(nr, nc);
  return key === STYLE_EDGE || key.startsWith(LINK_STYLE_PREFIX) ? key : STYLE_EDGE;
}

const cellOutside = (r: number, c: number, top: number, bottom: number, left: number, right: number): [number, number] =>
  r === top ? [r - 1, c] : r === bottom ? [r + 1, c] : c === left ? [r, c - 1] : c === right ? [r, c + 1] : [r, c];
export function edgeStrokeOutside(canvas: Canvas, r: number, c: number, top: number, bottom: number, left: number, right: number, plain: string): string {
  const [nr, nc] = cellOutside(r, c, top, bottom, left, right);
  const ch = canvas.get(nr, nc);
  const strokes = r === top || r === bottom ? RUN_DOWN : RUN_ACROSS;
  return strokes.has(ch) && onAnEdge(canvas.getStyle(nr, nc)) ? ch : plain;
}

// A head is the only mark saying an edge ARRIVES: written over, the edge leaves the drawing.
export const ARROWHEADS: ReadonlySet<string> = new Set(
  [...CHARSETS.values()].flatMap((set) => [set.arrowRight, set.arrowLeft, set.arrowDown, set.arrowUp])
);

// A block diagram's link wears `EDGE_HEAD` on its head where a graph edge wears `ARROW`.
// A relation inked with its class's colour (`arrow@ink:#e879f9`) is on an edge all the same.
export const onAnEdge = (style: string): boolean => {
  const [base] = inkApart(style);
  return base === STYLE_EDGE || base === ARROW || base === EDGE_HEAD || base.startsWith(LINK_STYLE_PREFIX);
};

export function edgeLeavesThrough(canvas: Canvas, r: number, c: number, top: number, bottom: number, left: number, right: number): boolean {
  const tee = stubOf(canvas.get(r, c));
  if (tee === undefined) return false;
  const [stub, stroke] = tee;
  const outward =
    (c === left && stub === "left") || (c === right && stub === "right") || (r === top && stub === "up") || (r === bottom && stub === "down");
  if (!outward) return false;
  canvas.recast(r, c, edgeStrokeOutside(canvas, r, c, top, bottom, left, right, stroke));
  canvas.setStyle(r, c, edgeKeyOutside(canvas, r, c, top, bottom, left, right));
  return true;
}
