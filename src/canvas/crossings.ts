import type { Canvas } from "./canvas.js";
import { cellId } from "./geometry.js";

// Two independent runs never meet in a `┼`: where one crosses another, the line down keeps the cell.
export class CrossingCut {
  private readonly running = new Map<string, boolean>();
  private readonly passing = new Map<string, readonly [vChar: string, style: string]>();
  private crossings: Array<readonly [col: number, row: number]> = [];

  constructor(private readonly landings: ReadonlySet<string> = new Set()) {}

  along(col: number, row: number, alongRow: boolean, vChar: string, style: string): void {
    const cell = cellId(col, row);
    if (this.landings.has(cell)) return;
    const held = this.running.get(cell);
    if (held !== undefined && held !== alongRow) this.crossings.push([col, row]);
    this.running.set(cell, alongRow);
    if (!alongRow) this.passing.set(cell, [vChar, style]);
  }

  // Puts the line down back on every crossing the run just drawn made.
  cut(canvas: Canvas): void {
    for (const [col, row] of this.crossings) {
      const goes = this.passing.get(cellId(col, row));
      if (goes !== undefined) canvas.put(row, col, goes[0], false, goes[1]);
    }
    this.crossings = [];
  }
}
