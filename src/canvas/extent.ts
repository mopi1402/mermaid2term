import { type Canvas } from "./canvas.js";
import { DEFAULT_STYLE } from "./keys.js";
import { SPACE } from "../text/chars.js";

// The first and last rows and columns a thing stands on.
export interface Edges {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

// The edges of a box given by its corner and size.
export const edgesOf = ({ x, y, w, h }: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): Edges => ({ top: y, bottom: y + h - 1, left: x, right: x + w - 1 });

export type Cell = readonly [row: number, col: number];

// The outline's cells: its two rules column by column, then its two walls row by row.
export function* ringCells({ top, bottom, left, right }: Edges): Generator<Cell> {
  for (let c = left; c <= right; c++) {
    yield [top, c];
    yield [bottom, c];
  }
  for (let r = top + 1; r < bottom; r++) {
    yield [r, left];
    yield [r, right];
  }
}

// Every cell of the box, row by row.
export function* boxCells({ top, bottom, left, right }: Edges): Generator<Cell> {
  for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) yield [r, c];
}

// Blank as the canvas's own alignment reads it: nothing stands on the cell and no style lies on it, a band's ground kept.
export const blankCell = (canvas: Canvas, row: number, col: number): boolean => canvas.get(row, col) === SPACE && canvas.getStyle(row, col) === DEFAULT_STYLE;

const glyphOn = (canvas: Canvas, row: number, col: number): boolean => canvas.get(row, col) !== SPACE;

// The columns a drawing inks from its left edge, its trailing blank ones left out; a glyph is ink unless `inked` says more.
export const inkedWidth = (canvas: Canvas, inked: (canvas: Canvas, row: number, col: number) => boolean = glyphOn): number => {
  let width = 0;
  for (let r = 0; r < canvas.height; r++) for (let c = canvas.width - 1; c >= width; c--) if (inked(canvas, r, c)) width = c + 1;
  return width;
};

export const blankColumns = (canvas: Canvas): number => {
  let left = canvas.width;
  for (let r = 0; r < canvas.height; r++) for (let c = 0; c < left; c++) if (!blankCell(canvas, r, c)) left = c;
  return left === canvas.width ? 0 : left;
};

// The columns a span holds, the gaps between them counted.
export const spanOf = (widths: readonly number[], gap: number): number => widths.reduce((total, width) => total + width, 0) + gap * Math.max(0, widths.length - 1);
