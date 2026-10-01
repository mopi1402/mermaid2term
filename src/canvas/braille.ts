import { type Canvas } from "./canvas.js";
import { cellId } from "./geometry.js";

// A braille cell holds two dots across and four down, each its own bit over the blank pattern.
const BLANK = 0x2800;
const LAST = 0x28ff;
export const DOTS_ACROSS = 2;
export const DOTS_DOWN = 4;
const BITS: readonly (readonly [number, number])[] = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

// A dot on the canvas's dot grid, `x` across and `y` down, two and four of them to a cell.
export interface Dot {
  readonly x: number;
  readonly y: number;
}

export const cellOfDot = ({ x, y }: Dot): { row: number; col: number } => ({ row: Math.floor(y / DOTS_DOWN), col: Math.floor(x / DOTS_ACROSS) });

export const dotsAcross = (cells: number): number => cells * DOTS_ACROSS;

export const dotsDown = (cells: number): number => cells * DOTS_DOWN;

const bitsOf = (ch: string): number => {
  const code = ch.codePointAt(0) ?? 0;
  return code >= BLANK && code <= LAST ? code - BLANK : 0;
};

// The dots of a straight run from one dot to the other, both ends in.
export function* dotRun(from: Dot, to: Dot): Generator<Dot> {
  const dx = Math.abs(to.x - from.x);
  const dy = -Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let { x, y } = from;
  let err = dx + dy;
  for (;;) {
    yield { x, y };
    if (x === to.x && y === to.y) return;
    const twice = 2 * err;
    if (twice >= dy) {
      err += dy;
      x += sx;
    }
    if (twice <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// Every dot inked in the style `styleAt` gives its cell, read before the dots land; a cell already braille keeps its
// own dots beside them, any other glyph is given up.
export function putDots(canvas: Canvas, dots: Iterable<Dot>, styleAt: (row: number, col: number) => string): void {
  const cells = new Map<string, { row: number; col: number; bits: number; style: string }>();
  for (const dot of dots) {
    const { row, col } = cellOfDot(dot);
    if (row < 0 || col < 0 || row >= canvas.height || col >= canvas.width) continue;
    const key = cellId(col, row);
    const cell = cells.get(key) ?? { row, col, bits: bitsOf(canvas.get(row, col)), style: styleAt(row, col) };
    cell.bits |= BITS[dot.y % DOTS_DOWN][dot.x % DOTS_ACROSS];
    cells.set(key, cell);
  }
  for (const { row, col, bits, style } of cells.values()) canvas.put(row, col, String.fromCodePoint(BLANK + bits), false, style);
}
