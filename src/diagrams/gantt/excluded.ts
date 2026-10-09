import { daySpellings, isExcludedDay, type Gantt } from "./model.js";
import type { CivilDate } from "./dates.js";

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
  let runStart: CivilDate | undefined;
  const close = (upTo: CivilDate): void => {
    if (runStart === undefined) return;
    const from = Math.max(first, columnOf(runStart));
    const to = Math.min(end, columnOf(upTo));
    for (let c = from; c < to; c++) columns.add(c);
    runStart = undefined;
  };
  const last = Math.ceil(latest);
  for (let day = Math.floor(earliest); day <= last; day++) {
    if (isExcludedDay(diagram, day, daySpellings(day, diagram.dateFormat))) {
      if (runStart === undefined) runStart = day;
    } else {
      close(day);
    }
  }
  close(last + 1);
  return columns;
}
