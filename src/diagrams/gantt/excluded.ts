import { daySpellings, isExcludedDay, type Gantt } from "./model.js";
import type { CivilDate } from "./dates.js";

// A column is washed when the last day before the next column is excluded, read once per column whatever the span.
export function excludedColumns(
  diagram: Gantt,
  earliest: CivilDate,
  latest: CivilDate,
  columnOf: (day: CivilDate) => number,
  first: number,
  end: number
): Set<number> {
  const columns = new Set<number>();
  if (diagram.excludes.length === 0) return columns;
  const lowest = Math.floor(earliest);
  const highest = Math.ceil(latest) + 1;
  for (let c = first; c < end; c++) {
    if (columnOf(highest) <= c) break;
    let lo = lowest;
    let hi = highest;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (columnOf(mid) > c) hi = mid;
      else lo = mid + 1;
    }
    const day = lo - 1;
    if (day >= lowest && isExcludedDay(diagram, day, daySpellings(day, diagram.dateFormat))) columns.add(c);
  }
  return columns;
}
