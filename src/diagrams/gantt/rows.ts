import { isSeated, seatedRows, type Band, type Row } from "./bars.js";
import type { Scale } from "./scale.js";

export interface Rows {
  readonly bySection: Array<Row[]>;
  // How many rows each line takes: one, or two where a compact name is written over two.
  readonly heights: number[][];
  readonly taskRows: number;
}

const taskRowsOf = (grouped: readonly Band[], heights: readonly number[][], compact: boolean): number =>
  grouped.reduce((sum, [lines], si) => sum + sectionHeight(lines.length, heights[si].reduce((a, b) => a + b, 0), compact), 0) +
  Math.max(0, grouped.length - 1);

// The same lines, each as tall as the names planned on it, `heights` given line after line in drawing order.
export function raised(rows: Rows, grouped: readonly Band[], flat: readonly number[], compact: boolean): Rows {
  let ordinal = 0;
  const heights = rows.bySection.map((lines) => lines.map(() => flat[ordinal++] ?? 1));
  return { bySection: rows.bySection, heights, taskRows: taskRowsOf(grouped, heights, compact) };
}

// A compact chart names only its sections in the margin, so a section's first bars share its name's row.
export const sectionHeight = (names: number, bars: number, compact: boolean): number =>
  compact ? Math.max(names, bars) : names + bars;

export function chartRows(grouped: readonly Band[], scale: Scale, compact: boolean): Rows {
  const bySection: Array<Row[]> = grouped.map(([, bars]) => {
    if (!compact) return bars.map((bar) => ({ bars: [bar], seats: [scale.extentOf(bar)].filter(isSeated) }));
    const seats = bars.map((bar) => [bar, scale.extentOf(bar)] as const);
    const seated = seatedRows(seats.map(([, seat]) => seat).filter(isSeated)).map((row) => ({
      bars: row.map((seat) => seat.bar),
      seats: row,
    }));
    const bare = seats.filter(([, seat]) => seat === undefined).map(([bar]) => ({ bars: [bar], seats: [] }));
    return [...seated, ...bare];
  });
  const heights = bySection.map((lines) => lines.map(() => 1));
  return { bySection, heights, taskRows: taskRowsOf(grouped, heights, compact) };
}
