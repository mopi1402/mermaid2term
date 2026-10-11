import { type CharSet } from "../../canvas/model.js";
import { XY_PLOT, onBarKey, onBarOf, indexAfter, indexed, type OverBar } from "../../canvas/keys.js";
import { cornerOf, type Toward } from "../../canvas/corners.js";
import { must } from "../../must.js";
import { cellId } from "../../canvas/geometry.js";
import { cellOfDot, dotRun, putDots, type Dot } from "../../canvas/braille.js";
import { LEFT_EIGHTHS, LOWER_EIGHTHS } from "../../canvas/alphabet.js";
import type { Canvas } from "../../canvas/canvas.js";

export const plotStyle = (plot: number): string => indexed(XY_PLOT, plot);

// A bar's cell a line's dots keep its colour under them on: a whole one, or a top inked at least this many eighths.
const HALF_EIGHTHS = 4;
const EIGHTHS = 8;

export interface Cell {
  row: number;
  col: number;
}

// The bar a cell shows, a whole cell or a top inked at least half way, or the one under a cell laid on a bar.
function barUnder(canvas: Canvas, cs: CharSet, row: number, col: number): number | undefined {
  const key = canvas.getStyle(row, col);
  const bar = indexAfter(key, XY_PLOT);
  const glyph = canvas.get(row, col);
  const eighths = glyph === cs.barFull ? EIGHTHS : Math.max(LOWER_EIGHTHS.indexOf(glyph), LEFT_EIGHTHS.indexOf(glyph)) + 1;
  return bar !== undefined && eighths >= HALF_EIGHTHS ? bar : onBarOf(key)?.bar;
}

// A plot's style for a cell it lays over an earlier bar's, the bar's colour kept under it; its own elsewhere.
export function onBarStyle(canvas: Canvas, cs: CharSet, row: number, col: number, plot: number, over: OverBar): string {
  const bar = barUnder(canvas, cs, row, col);
  return bar === undefined || bar === plot ? plotStyle(plot) : onBarKey(plot, bar, over);
}

// Every line of one chart, a straight run of braille dots from point to point where the charset draws them, a run of
// strokes around the cells the earlier lines hold otherwise; the cells its points stand on back. A dotted cell keeps
// the bar it lies on as its ground where that cell is whole or inked at least half way, the bar itself never moved.
export function linesOn(canvas: Canvas, cs: CharSet, rounded: boolean, sideways: boolean): (cells: Cell[], dots: Dot[], plot: number) => Cell[] {
  const held = new Map<string, string>();
  return (cells, dots, plot) => {
    const style = plotStyle(plot);
    if (!cs.plotDots) {
      drawLine(canvas, cells, cs, rounded, style, sideways, held);
      return cells;
    }
    const styleAt = (row: number, col: number): string => onBarStyle(canvas, cs, row, col, plot, "dots");
    putDots(canvas, dots.flatMap((dot, i) => (i === 0 ? [dot] : [...dotRun(dots[i - 1], dot)])), styleAt);
    return dots.map(cellOfDot);
  };
}

// A mark on every point, joined by runs that turn half way between two points. On its side the runs go down the
// rows and the picture is mirrored on its diagonal, which swaps two of the four corners. A cell an earlier line
// holds stays its own: this line is cut there, and turns where it does not run along or corner on that line.
function drawLine(canvas: Canvas, cells: Cell[], cs: CharSet, rounded: boolean, style: string, sideways: boolean, held: Map<string, string>): void {
  const own = new Map<string, Cell & { ch: string }>();
  const put = (row: number, col: number, ch: string): void => void own.set(cellId(col, row), { row, col, ch });
  cells.forEach((cell, i) => {
    put(cell.row, cell.col, sideways ? cs.vertical : cs.horizontal);
    if (i > 0) connect(put, held, cells[i - 1], cell, cs, rounded, sideways);
  });
  const strokes = [cs.horizontal, cs.vertical];
  // Where this line would run along or corner on an earlier one, a blank parts them, its points kept.
  const merged = (key: string): boolean => {
    const under = held.get(key);
    const mine = own.get(key);
    return under !== undefined && mine !== undefined && !(strokes.includes(under) && strokes.includes(mine.ch) && under !== mine.ch);
  };
  const points = new Set(cells.map(({ row, col }) => cellId(col, row)));
  const parted = (row: number, col: number): boolean => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dr, dc]) => merged(cellId(col + dc, row + dr)));
  const laid = [...own].filter(([key, { row, col }]) => !held.has(key) && (points.has(key) || !parted(row, col)));
  for (const [key, cell] of laid) {
    canvas.put(cell.row, cell.col, cell.ch, false, style);
    held.set(key, cell.ch);
  }
}

function connect(
  putCell: (row: number, col: number, ch: string) => void,
  held: ReadonlyMap<string, string>,
  from: Cell,
  to: Cell,
  cs: CharSet,
  rounded: boolean,
  sideways: boolean,
): void {
  const run = sideways ? cs.vertical : cs.horizontal;
  const cross = sideways ? cs.horizontal : cs.vertical;
  const [a1, b1, a2, b2] = sideways ? [from.row, from.col, to.row, to.col] : [from.col, from.row, to.col, to.row];
  const put = (a: number, b: number, ch: string): void => (sideways ? putCell(a, b, ch) : putCell(b, a, ch));

  if (b1 === b2) {
    for (let a = a1 + 1; a < a2; a++) put(a, b1, run);
    return;
  }

  const middle = turnOf(held, a1, a2, b1, b2, run, cross, sideways);
  const along: Toward = sideways ? "down" : "right";
  const turn: Toward = b2 < b1 ? (sideways ? "left" : "up") : sideways ? "right" : "down";

  for (let a = a1 + 1; a < middle; a++) put(a, b1, run);
  put(middle, b1, must(cornerOf(along, turn, cs, rounded)));
  for (let b = Math.min(b1, b2) + 1; b < Math.max(b1, b2); b++) put(middle, b, cross);
  put(middle, b2, must(cornerOf(turn, along, cs, rounded)));
  for (let a = middle + 1; a < a2; a++) put(a, b2, run);
}

// Half way between the two points, or the step off it nearest there that lays the fewest cells over an earlier
// line, its crossings aside, then the fewest alongside that line's turns.
function turnOf(held: ReadonlyMap<string, string>, a1: number, a2: number, b1: number, b2: number, run: string, cross: string, sideways: boolean): number {
  const middle = Math.floor((a1 + a2) / 2);
  const [low, high] = [Math.min(b1, b2), Math.max(b1, b2)];
  const heldAt = (a: number, b: number): string | undefined => held.get(sideways ? cellId(b, a) : cellId(a, b));
  const over = (a: number, b: number, crossing?: string): number => (heldAt(a, b) === undefined || heldAt(a, b) === crossing ? 0 : 1);
  const cost = (turn: number): number => {
    let laid = over(turn, b1) + over(turn, b2);
    let beside = 0;
    for (let a = a1 + 1; a < a2; a++) if (a !== turn) laid += over(a, a < turn ? b1 : b2, cross);
    for (let b = low + 1; b < high; b++) laid += over(turn, b, run);
    for (let b = low; b <= high; b++) beside += over(turn - 1, b, run) + over(turn + 1, b, run);
    return laid * (high - low + 3) + beside;
  };
  const steps = Array.from({ length: a2 - a1 - 1 }, (_, i) => a1 + 1 + i).sort((x, y) => cost(x) - cost(y) || Math.abs(x - middle) - Math.abs(y - middle));
  return steps[0] ?? middle;
}
