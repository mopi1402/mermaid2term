import { drawnChar } from "../text/entities.js";
import { glyphsOf, isWideGlyph } from "../text/width.js";
import { NEWLINE, SPACE } from "../text/chars.js";
import { DEFAULT_STYLE } from "./keys.js";
import { SHADOW, directionsOf } from "./merge.js";
import { glyphOfArms } from "./corners.js";
import { UNICODE } from "./charsets.js";
import { alignPlanes, raisePlanes, compactPlanes } from "./reshape.js";
import { growPlanes, planeList, planeOf, type Planes } from "./planes.js";

export { DEFAULT_STYLE };
export { DOWN, LEFT, RIGHT, UP } from "./merge.js";

// The size of a canvas with nothing to draw on it.
export const EMPTY_SIZE = 1;

type StyledCell = readonly [string, string];

export interface TextClash {
  row: number;
  col: number;
  text: string;
  by: string;
}

let clashWatcher: ((clash: TextClash) => void) | undefined;

// Heard for every write a text cell refused, so a check can hold a drawing to having refused none.
export function watchTextClashes(watcher: ((clash: TextClash) => void) | undefined): void {
  clashWatcher = watcher;
}

export class Canvas {
  private grid: string[][];
  private styles: string[][];
  private protectedCells: boolean[][];
  private directions: number[][];
  private textCells: boolean[][];
  private linkCells: (string | undefined)[][];

  constructor(
    public width: number,
    public height: number
  ) {
    this.grid = planeOf(width, height, SPACE);
    this.styles = planeOf(width, height, DEFAULT_STYLE);
    this.protectedCells = planeOf(width, height, false);
    this.textCells = planeOf(width, height, false);
    this.linkCells = planeOf<string | undefined>(width, height, undefined);
    this.directions = planeOf(width, height, 0);
  }

  resize(newWidth: number, newHeight: number): void {
    const { width, height } = growPlanes(this.planes(), this, newWidth, newHeight, DEFAULT_STYLE, SPACE);
    this.width = width;
    this.height = height;
  }

  private inside(row: number, col: number): boolean {
    return row >= 0 && row < this.height && col >= 0 && col < this.width;
  }

  get(row: number, col: number): string {
    return this.inside(row, col) ? (this.grid[row][col]) : SPACE;
  }

  protect(row: number, col: number): void {
    if (this.inside(row, col)) this.protectedCells[row][col] = true;
  }

  isProtected(row: number, col: number): boolean {
    return this.inside(row, col) ? (this.protectedCells[row][col]) : false;
  }

  recast(row: number, col: number, ch: string): void {
    if (this.inside(row, col)) this.grid[row][col] = ch;
  }

  // A BLANK is refused: whatever shows through one belongs to the geometry. Clearing a cell, colouring one, or
  // writing a word with spaces in it each has its own call for that reason.
  put(row: number, col: number, ch: string, merge = true, style = ""): void {
    ch = drawnChar(ch);
    if (!this.inside(row, col) || ch === SPACE) return;
    if (this.holdsText(row, col, ch)) return;

    const newDirs = directionsOf(ch);
    const existing = this.grid[row][col];
    const existingDirs = this.directions[row][col];

    if (existing === SPACE) {
      this.grid[row][col] = ch;
      this.directions[row][col] = newDirs;
      this.textCells[row][col] = false;
    } else if (merge && existingDirs !== 0 && newDirs !== 0) {
      const combined = existingDirs | newDirs;
      if (this.isProtected(row, col) && combined === existingDirs) return;
      this.grid[row][col] = glyphOfArms(combined, UNICODE, false);
      this.directions[row][col] = combined;
      this.textCells[row][col] = false;
    } else if (this.isProtected(row, col)) {
      return;
    } else {
      this.grid[row][col] = ch;
      this.directions[row][col] = newDirs;
      this.textCells[row][col] = false;
    }

    if (style !== "") this.styles[row][col] = style;
  }

  // A written character is never drawn over, by a line or by other words: the first to land keeps its cell.
  private holdsText(row: number, col: number, by: string): boolean {
    const text = this.grid[row][col];
    if (!this.textCells[row][col] || text === SPACE || text === by) return false;
    clashWatcher?.({ row, col, text, by });
    return true;
  }

  private markText(row: number, col: number, ch: string): void {
    if (!this.inside(row, col)) return;
    if (ch === SPACE && this.get(row, col) !== SPACE) return;
    this.textCells[row][col] = true;
  }

  putText(row: number, col: number, text: string, style = ""): void {
    let offset = 0;
    const glyphs = glyphsOf(text);
    const first = glyphs.findIndex((ch) => ch !== SPACE);
    const last = glyphs.length - 1 - [...glyphs].reverse().findIndex((ch) => ch !== SPACE);
    glyphs.forEach((ch, i) => {
      // A space between two words wears the words' ground, so a band never breaks inside them.
      const grounded = ch === SPACE && first >= 0 && i > first && i < last && style !== "";
      offset += this.writeGlyph(row, col + offset, ch, style, grounded);
    });
  }

  putStyledText(row: number, col: number, segments: Array<readonly [string, string]>): void {
    let offset = 0;
    for (const [text, style] of segments) for (const ch of glyphsOf(text)) offset += this.writeGlyph(row, col + offset, ch, style, false);
  }

  // One glyph of a text, the columns it takes returned: a wide one leaves a shadow in the cell after it.
  private writeGlyph(row: number, col: number, ch: string, style: string, grounded: boolean): number {
    this.put(row, col, ch, false, style);
    if (grounded && this.get(row, col) === SPACE) this.setStyle(row, col, style);
    this.markText(row, col, ch);
    if (!isWideGlyph(ch)) return 1;
    this.blankShadowCell(row, col + 1, style);
    this.markText(row, col + 1, SHADOW);
    return 2;
  }

  private blankShadowCell(row: number, col: number, style: string): void {
    if (row >= 0 && row < this.height && col >= 1 && col < this.width) {
      this.grid[row][col] = SHADOW;
      this.styles[row][col] = style;
    }
  }

  clearChar(row: number, col: number): void {
    if (this.inside(row, col) && !this.holdsText(row, col, SPACE)) this.grid[row][col] = SPACE;
  }

  setStyle(row: number, col: number, style: string): void {
    if (this.inside(row, col)) this.styles[row][col] = style;
  }

  getStyle(row: number, col: number): string {
    return this.inside(row, col) ? (this.styles[row][col]) : DEFAULT_STYLE;
  }

  isText(row: number, col: number): boolean {
    return this.inside(row, col) ? (this.textCells[row][col]) : false;
  }

  // `overlay` leaves this canvas showing wherever the other holds a bare blank.
  stamp(other: Canvas, row: number, col: number, overlay = false): void {
    const mine = planeList(this.planes());
    const theirs = planeList(other.planes());
    for (let r = 0; r < other.height; r++) {
      const rr = row + r;
      for (let c = 0; c < other.width; c++) {
        const cc = col + c;
        if (!this.inside(rr, cc)) continue;
        if (overlay && other.grid[r][c] === SPACE && other.styles[r][c] === DEFAULT_STYLE) continue;
        for (let p = 0; p < mine.length; p++) mine[p][rr][cc] = theirs[p][r][c];
      }
    }
  }

  toStyledPairs(): StyledCell[][] {
    const result: StyledCell[][] = [];
    for (let r = 0; r < this.height; r++) {
      const row: StyledCell[] = [];
      for (let c = 0; c < this.width; c++) {
        row.push([this.grid[r][c], this.styles[r][c]]);
      }
      result.push(row);
    }
    return result;
  }

  linkLabel(row: number, col: number, width: number, height: number, url: string): void {
    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        if (!this.inside(r, c)) continue;
        if (this.textCells[r][c] !== true) continue;
        this.linkCells[r][c] = url;
      }
    }
  }

  toLinkRows(): (string | undefined)[][] {
    return this.linkCells.map((row) => [...row]);
  }

  // From `from` up to `until`, left out, and nothing where `until` is not past `from`: unlike `drawHorizontal`, never swapped.
  putRow(row: number, from: number, until: number, ch: string, merge = true, style = ""): void {
    for (let c = from; c < until; c++) this.put(row, c, ch, merge, style);
  }

  putColumn(col: number, from: number, until: number, ch: string, merge = true, style = ""): void {
    for (let r = from; r < until; r++) this.put(r, col, ch, merge, style);
  }

  drawHorizontal(row: number, colStart: number, colEnd: number, ch: string, style = ""): void {
    for (let c = Math.min(colStart, colEnd); c <= Math.max(colStart, colEnd); c++) this.put(row, c, ch, true, style);
  }

  drawVertical(col: number, rowStart: number, rowEnd: number, ch: string, style = ""): void {
    for (let r = Math.min(rowStart, rowEnd); r <= Math.max(rowStart, rowEnd); r++) this.put(r, col, ch, true, style);
  }

  toString(): string {
    // `trimEnd` and not `/\s+$/`: unanchored, V8 retries the regex from every position, so the scan is linear in the
    // row's width even where there is nothing to cut, which is most rows.
    const lines = this.grid.map((row) => row.join("").trimEnd());
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines.join(NEWLINE);
  }
  private planes(): Planes {
    return {
      grid: this.grid,
      styles: this.styles,
      protectedCells: this.protectedCells,
      textCells: this.textCells,
      linkCells: this.linkCells,
      directions: this.directions,
    };
  }

  alignTopLeft(): void {
    alignPlanes(this.planes(), this.width, this.height);
  }

  // Drops up to `most` blank rows off the top, returning how many went.
  raise(most: number): number {
    return raisePlanes(this.planes(), this.height, most);
  }

  compactRuns(keepRows: number, keepCols: number, spareStyles: ReadonlySet<string> = new Set()): void {
    const { width, height } = compactPlanes(this.planes(), this, keepRows, keepCols, spareStyles);
    this.width = width;
    this.height = height;
  }
}
