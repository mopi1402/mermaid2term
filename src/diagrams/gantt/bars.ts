import { must } from "../../must.js";
import type { CivilDate } from "./dates.js";

export type BarStyle = "milestone" | "done" | "active" | "normal";

export type Bar = readonly [string, CivilDate | undefined, CivilDate | undefined, BarStyle, boolean, string | undefined, boolean];

// A section's name, one entry per line its `<br>` breaks it into, and its bars.
export type Band = readonly [readonly string[], Bar[]];

export type Seated = { readonly bar: Bar; readonly from: number; readonly to: number };
export const isSeated = (seat: Seated | undefined): seat is Seated => seat !== undefined;

export type Row = { readonly bars: readonly Bar[]; readonly seats: readonly Seated[] };

// mermaid's compact seating: each bar takes the first row whose last bar ends clear of it, bars taken in the order
// their dates OPEN and, on a tie, in the order the source declared them. Any other order seats them elsewhere.
export function seatedRows(seats: readonly Seated[]): Seated[][] {
  const rows: Seated[][] = [];
  const ends: number[] = [];
  const order = new Map<Seated, number>(seats.map((seat, i) => [seat, i]));
  const sorted = [...seats].sort((a, b) => a.from - b.from || (must(order.get(a))) - (must(order.get(b))));
  for (const seat of sorted) {
    let row = 0;
    while (row < ends.length && seat.from <= (ends[row])) row += 1;
    ends[row] = seat.to;
    (rows[row] ??= []).push(seat);
  }
  return rows;
}
