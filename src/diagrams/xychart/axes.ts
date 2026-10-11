import { type CharSet } from "../../canvas/model.js";
import type { AxisShown } from "./model.js";
import { displayWidth } from "../../text/width.js";
import type { Canvas } from "../../canvas/canvas.js";
import type { XyAxisKeys } from "../../canvas/keys.js";
import { ticks } from "../@common/ticks.js";
import { MOST_TICKS, type LaidOut } from "./rooms.js";

// Where in its cell a tick is read, and a value it names reaches.
const TICK_CENTRE = 0.5;

// A mark along the category axis: the cell it stands on and the text under or beside it.
interface Mark {
  readonly at: number;
  readonly text: string;
}

// The first of d3's tick sets, from ten ticks down, whose neighbours `fit` beside each other; the fewest where none
// does.
export function thinnedTicks(low: number, high: number, fit: (a: number, b: number) => boolean): number[] {
  for (let count = MOST_TICKS; count > 1; count--) {
    const set = ticks(low, high, count);
    if (set.every((tick, i) => i === 0 || fit(set[i - 1], tick))) return set;
  }
  return ticks(low, high, 1);
}

// Two texts centred on their cells keep a blank between them.
export const clearOf = (a: Mark, b: Mark): boolean => Math.abs(b.at - a.at) >= Math.ceil((displayWidth(a.text) + displayWidth(b.text)) / 2) + 1;

// The category axis's marks: a band's names on their own points, or a linear axis's d3 ticks spread from the first
// point to the last as mermaid's scale lays them, as many as `fit` beside each other.
export function categoryMarks(laid: LaidOut, names: readonly string[], centreOf: (point: number) => number, fit: (a: Mark, b: Mark) => boolean): Mark[] {
  if (laid.xDomain === undefined) return names.map((text, i) => ({ at: centreOf(i), text }));
  const [lo, hi] = laid.xDomain;
  const first = centreOf(0);
  const last = centreOf(laid.points - 1);
  const markOf = (tick: number): Mark => ({ at: hi === lo ? first : Math.round(first + ((tick - lo) / (hi - lo)) * (last - first)), text: String(tick) });
  return thinnedTicks(lo, hi, (a, b) => fit(markOf(a), markOf(b))).map(markOf);
}

// The cell a value's tick stands on, from the plot's first, `-1` for the axis itself.
export const tickCell = (reach: number): number => Math.max(-1, Math.round(reach - TICK_CENTRE));

// How far a value reaches on a scale of `cells`, in cells from the axis. A tick is read on the middle of its cell, the
// lowest on the first, as mermaid's linear axis pads its range at each end.
export const reachOf = (value: number, low: number, span: number, cells: number): number => ((value - low) / span) * cells + TICK_CENTRE;

// The cells a plot takes for a scale of `cells`: half a cell of padding at each end.
export const paddedOf = (cells: number): number => cells + 2 * TICK_CENTRE;

// The cell a reach ends in, the one whose middle is nearest it, from the plot's first.
export const cellAt = (reach: number): number => Math.max(0, Math.round(reach - TICK_CENTRE));

// The dot a reach ends on, of `perCell` to a cell over `cells`: the one whose middle is nearest it.
export const dotAt = (reach: number, perCell: number, cells: number): number =>
  Math.min(cells * perCell - 1, Math.max(0, Math.round(reach * perCell - TICK_CENTRE)));

// An axis's line key where the line is shown.
export const shownLine = (shown: AxisShown, keys: XyAxisKeys): string | undefined => (shown.line ? keys.line : undefined);

// A tick joined to its axis line, or a bare stub where the line is not shown.
export function putTick(canvas: Canvas, row: number, col: number, shown: AxisShown, tee: string, stub: string, key: string): void {
  if (shown.tick) canvas.put(row, col, shown.line ? tee : stub, false, key);
}

// The side axis down the left and the foot axis along the bottom, each where it is shown, meeting in the corner;
// the foot's row back.
export function drawAxes(canvas: Canvas, cs: CharSet, left: number, top: number, rows: number, width: number, side: string | undefined, foot: string | undefined): number {
  const axisRow = top + rows;
  if (side !== undefined) canvas.putColumn(left, top, axisRow, cs.vertical, false, side);
  if (foot !== undefined) canvas.putRow(axisRow, left + 1, left + 1 + width, cs.horizontal, false, foot);
  const corner = side !== undefined && foot !== undefined ? cs.bottomLeft : side !== undefined ? cs.vertical : foot !== undefined ? cs.horizontal : undefined;
  const cornerKey = side ?? foot;
  if (corner !== undefined && cornerKey !== undefined) canvas.put(axisRow, left, corner, false, cornerKey);
  return axisRow;
}
