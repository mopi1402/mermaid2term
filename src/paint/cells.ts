import { displayWidth } from "../text/width.js";
import { must } from "../must.js";
import { NEWLINE, SPACE, TAB } from "../text/chars.js";

export interface Cell {
  readonly ch: string;
  readonly style: string;
  readonly link?: string;
  // The canvas key the cell was painted from, which nothing emits: it says who owns the cell to a check that asks.
  readonly owner?: string;
}

const STRIPPED_CONTROL: ReadonlySet<number> = new Set([0x07, 0x08, 0x0b, 0x0c, 0x0d]);
export const stripControlCodes = (text: string): string =>
  [...text].filter((ch) => !STRIPPED_CONTROL.has(must(ch.codePointAt(0)))).join("");

export const NO_CELL_STYLE = "";
const TAB_SIZE = 8;
const SPACE_RE = /\s/u;
const isSpace = (ch: string): boolean => SPACE_RE.test(ch);

export const cellsPlain = (cells: readonly Cell[]): string => cells.map((cell) => cell.ch).join("");
export const cellLen = (cells: readonly Cell[]): number => cells.reduce((total, cell) => total + displayWidth(cell.ch), 0);

function rstripCells(cells: readonly Cell[]): Cell[] {
  let end = cells.length;
  while (end > 0 && isSpace(cells[end - 1].ch)) end--;
  return cells.slice(0, end);
}

function* words(cells: readonly Cell[]): Generator<readonly [number, readonly Cell[]]> {
  let pos = 0;
  while (pos < cells.length) {
    const start = pos;
    let at = pos;
    while (at < cells.length && isSpace(cells[at].ch)) at++;
    if (at >= cells.length) return;
    while (at < cells.length && !isSpace(cells[at].ch)) at++;
    while (at < cells.length && isSpace(cells[at].ch)) at++;
    yield [start, cells.slice(start, at)];
    pos = at;
  }
}

function chopCells(cells: readonly Cell[], width: number): Cell[][] {
  const lines: Cell[][] = [];
  let lineSize = 0;
  let offset = 0;
  for (let i = 0; i < cells.length; i++) {
    const size = displayWidth(cells[i].ch);
    if (lineSize + size > width) {
      lines.push(cells.slice(offset, i));
      offset = i;
      lineSize = 0;
    }
    lineSize += size;
  }
  if (lineSize) lines.push(cells.slice(offset));
  return lines;
}

export function divideLine(cells: readonly Cell[], width: number, fold: boolean): number[] {
  const breaks: number[] = [];
  let cellOffset = 0;

  for (const [wordStart, word] of words(cells)) {
    let start = wordStart;
    const wordLength = cellLen(rstripCells(word));
    const remaining = width - cellOffset;

    if (remaining >= wordLength) {
      cellOffset += cellLen(word);
    } else if (wordLength > width) {
      if (fold) {
        const folded = chopCells(word, width);
        for (let i = 0; i < folded.length; i++) {
          const piece = folded[i];
          if (start) breaks.push(start);
          if (i === folded.length - 1) cellOffset = cellLen(piece);
          else start += piece.length;
        }
      } else {
        if (start) breaks.push(start);
        cellOffset = cellLen(word);
      }
    } else if (cellOffset && start) {
      breaks.push(start);
      cellOffset = cellLen(word);
    }
  }

  return breaks;
}

export function rstripEnd(cells: readonly Cell[], size: number): Cell[] {
  if (cells.length <= size) return [...cells];
  const excess = cells.length - size;
  const stripped = rstripCells(cells);
  const blanks = cells.length - stripped.length;
  return cells.slice(0, cells.length - Math.min(blanks, excess));
}

export function cropToCells(cells: readonly Cell[], width: number): Cell[] {
  const kept: Cell[] = [];
  let size = 0;
  for (const cell of cells) {
    const next = size + displayWidth(cell.ch);
    if (next > width) break;
    kept.push(cell);
    size = next;
  }
  return kept;
}

export function expandTabs(line: readonly Cell[]): Cell[] {
  if (!line.some((cell) => cell.ch === TAB)) return [...line];
  const out: Cell[] = [];
  let position = 0;
  for (const cell of line) {
    if (cell.ch !== TAB) {
      out.push(cell);
      position += displayWidth(cell.ch);
      continue;
    }
    out.push({ ch: SPACE, style: cell.style });
    position += 1;
    const remainder = position % TAB_SIZE;
    if (remainder === 0) continue;
    for (let n = TAB_SIZE - remainder; n > 0; n--) out.push({ ch: SPACE, style: cell.style });
    position += TAB_SIZE - remainder;
  }
  return out;
}

export function splitCells(cells: readonly Cell[]): Cell[][] {
  const lines: Cell[][] = [];
  let current: Cell[] = [];
  for (const cell of cells) {
    if (cell.ch === NEWLINE) {
      lines.push(current);
      current = [];
    } else current.push(cell);
  }
  lines.push(current);
  return lines;
}
