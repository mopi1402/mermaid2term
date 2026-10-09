import { clampedOn, displayWidth, truncateToWidth } from "../../text/width.js";
import type { CivilDate } from "./dates.js";
import type { Scale } from "./scale.js";
import { isSolo, type Scene } from "./scene.js";
import { STYLE_MILESTONE, STYLE_VERT } from "./ink.js";
import { LIGHT, NONE, plain as box, type Weight } from "../../canvas/arms.js";
import { SPACE } from "../../text/chars.js";
import type { Under } from "./names.js";
import { AXIS_ROWS } from "./metrics.js";

export interface MarkerSeat {
  readonly col: number;
  readonly label: string;
  readonly at: number;
  readonly row: number;
  // A milestone's name sent under the dates: its line runs down from the mark, not from the chart's top.
  readonly under: Under | undefined;
}

export type MarkerEntry = readonly [CivilDate, string] | readonly [CivilDate, string, Under];

export function seatMarkers(markers: readonly MarkerEntry[], scale: Scale): MarkerSeat[] {
  const seats: MarkerSeat[] = [];
  // Every row's taken cells: the names, and the line a milestone's name hangs from on the rows above it.
  const taken: Array<Array<readonly [number, number]>> = [];
  const free = (row: number, from: number, to: number): boolean =>
    (taken[row] ?? []).every(([a, b]) => to < a - 1 || from > b + 1);
  // The milestones first: their lines are laid before any marker's name, which then steps round them.
  const ordered = [...markers.filter((entry) => entry[2] !== undefined), ...markers.filter((entry) => entry[2] === undefined)];
  for (const [marker, label, under] of ordered) {
    const offset = marker - scale.earliest;
    if (offset < 0 || offset > scale.span) continue;
    const col = under?.seat.from ?? scale.columnOf(marker);
    const text = truncateToWidth(label, scale.drawnWidth);
    const at = clampedOn(col, text, scale.drawnWidth);
    const end = at + displayWidth(text) - 1;
    const clear = (row: number): boolean => under === undefined || Array.from({ length: row }, (_, r) => r).every((r) => free(r, col, col));
    // A row past every taken one is always free for the name: a line another milestone's name still blocks breaks there.
    let row = 0;
    while (row < taken.length && !(free(row, at, end) && clear(row))) row += 1;
    for (let r = 0; r <= row; r++) (taken[r] ??= []).push(r === row ? [at, end] : [col, col]);
    seats.push({ col, label: text, at, row, under });
  }
  return seats;
}

export const markerRowsOf = (seats: readonly MarkerSeat[]): number =>
  seats.reduce((rows, seat) => Math.max(rows, seat.row + 1), 0);

export function drawMarkers(scene: Scene, seats: readonly MarkerSeat[], axisRow: number, topAxis: boolean, lineTops: readonly number[]): void {
  const { canvas, cs } = scene;
  for (const seat of seats) {
    const under = seat.under;
    if (under !== undefined) {
      // A milestone's line, from under the mark through the axis and its dates down to its name, in the milestones' own
      // ink: a date's letter the line runs over is given up to it.
      const ink = STYLE_MILESTONE;
      const nameRow = axisRow + AXIS_ROWS + seat.row;
      for (let r = (lineTops[under.ordinal] ?? axisRow) + 1; r < nameRow; r++) {
        if (r === axisRow) {
          const across = (c: number): Weight => (canvas.get(axisRow, c) === SPACE ? NONE : LIGHT);
          canvas.put(r, seat.col, box(across(seat.col - 1), across(seat.col + 1), LIGHT, LIGHT), false, ink);
        } else if (r === axisRow + 1) {
          canvas.recast(r, seat.col, cs.vertical);
          canvas.setStyle(r, seat.col, ink);
        } else if (r > axisRow) {
          canvas.put(r, seat.col, cs.vertical, false, ink);
        } else if (!isSolo(scene, r, seat.col)) canvas.put(r, seat.col, cs.vertical, false, ink);
      }
      canvas.putText(nameRow, seat.at, seat.label, ink);
      continue;
    }
    // Heavy, so a marker still reads apart from the tick lines where no colour is drawn.
    for (let r = scene.chartTop; r < axisRow; r++) {
      if (!isSolo(scene, r, seat.col)) canvas.put(r, seat.col, cs.lineThickV, false, STYLE_VERT);
    }
    canvas.put(axisRow, seat.col, cs.teeUp, false, STYLE_VERT);
    if (topAxis) canvas.put(scene.chartTop - 1, seat.col, cs.teeDown, false, STYLE_VERT);
    canvas.putText(axisRow + AXIS_ROWS + seat.row, seat.at, seat.label, STYLE_VERT);
  }
}
