import type { Canvas } from "../../canvas/canvas.js";
import type { CharSet } from "../../canvas/model.js";
import { glyphOfArms } from "../../canvas/corners.js";
import { cellId } from "../../canvas/geometry.js";
import { ACROSS, DOWN, DOWNWARD, LEFT, RIGHT, UP } from "../../canvas/merge.js";
import { GIT_SPINE } from "../../canvas/keys.js";

interface Cell {
  row: number;
  col: number;
  arms: number;
  key: string;
  rank: number;
  // The ink of the last stroke laid across, then down, the cell: a crossing keeps the one its lane runs along.
  inks: [string, string];
}

// mermaid lays the arrows over the dashed `.branch` spine, the later arrow over the earlier one.
export const SPINE_RANK = 0;
export const LINK_RANK = 1;

// Every branch line and connector, gathered before one glyph is chosen per cell, so an end reads as the corner or
// tee it is instead of the cross two whole strokes would merge into.
export class Wires {
  private cells = new Map<string, Cell>();

  // `acrossLanes`: the branch lines run across the canvas, as they do left to right.
  constructor(private readonly acrossLanes: boolean) {}

  private arm(row: number, col: number, arms: number, key: string, rank: number): void {
    const id = cellId(col, row);
    const cell = this.cells.get(id);
    const inks = (held: [string, string]): [string, string] => ((arms & ACROSS) !== 0 ? [key, held[1]] : [held[0], key]);
    if (cell === undefined) {
      this.cells.set(id, { row, col, arms, key, rank, inks: inks([key, key]) });
      return;
    }
    // A bare branch line never joins an arrow: the arrow drawn over it takes the cell whole.
    if (rank < cell.rank) return;
    if (rank > cell.rank) Object.assign(cell, { arms, key, rank, inks: inks([key, key]) });
    else Object.assign(cell, { arms: cell.arms | arms, key, inks: inks(cell.inks) });
  }

  segment(r1: number, c1: number, r2: number, c2: number, key: string, rank = LINK_RANK): void {
    if (r1 === r2) {
      const [from, to] = [Math.min(c1, c2), Math.max(c1, c2)];
      for (let c = from; c <= to; c++) this.arm(r1, c, (c > from ? LEFT : 0) | (c < to ? RIGHT : 0) | (from === to ? ACROSS : 0), key, rank);
      return;
    }
    const [from, to] = [Math.min(r1, r2), Math.max(r1, r2)];
    for (let r = from; r <= to; r++) this.arm(r, c1, (r > from ? UP : 0) | (r < to ? DOWN : 0), key, rank);
  }

  paint(canvas: Canvas, cs: CharSet, rounded: boolean): void {
    for (const { row, col, arms, key, inks } of this.cells.values()) {
      // Two lines never cross: the lane runs on and the arrow sent across it is cut.
      if (arms === (ACROSS | DOWNWARD)) {
        if (this.acrossLanes) canvas.put(row, col, cs.lineHorizontal, false, inks[0]);
        else canvas.put(row, col, cs.lineVertical, false, inks[1]);
        continue;
      }
      canvas.put(row, col, key === GIT_SPINE ? spineOf(arms, cs, rounded) : glyphOfArms(arms, cs, rounded), false, key);
    }
  }
}

// A bare branch line no arrow runs along is dashed, one half stroke a cell.
const spineOf = (arms: number, cs: CharSet, rounded: boolean): string =>
  (arms & DOWNWARD) === 0 ? cs.spineAcross : (arms & ACROSS) === 0 ? cs.spineDown : glyphOfArms(arms, cs, rounded);
