import { displayWidth } from "../../text/width.js";
import type { Gantt } from "./model.js";
import type { Band, Bar, BarStyle } from "./bars.js";
import type { CivilDate } from "./dates.js";

export interface Collected {
  readonly grouped: Band[];
  readonly markers: Array<[CivilDate, string]>;
  readonly earliest: CivilDate | undefined;
  readonly latest: CivilDate | undefined;
  readonly labelWidth: number;
}

export function collectBars(diagram: Gantt, compact: boolean): Collected {
  const grouped: Band[] = [];
  const markers: Array<[CivilDate, string]> = [];
  let earliest: CivilDate | undefined;
  let latest: CivilDate | undefined;
  let labelWidth = 0;

  for (const section of diagram.sections) {
    const bars: Bar[] = [];
    for (const task of section.tasks) {
      if (task.isVert) {
        if (task.start !== undefined) {
          markers.push([task.start, task.title]);
          if (earliest === undefined || task.start < earliest) earliest = task.start;
          if (latest === undefined || task.start > latest) latest = task.start;
        }
        continue;
      }
      const style: BarStyle = task.isMilestone
        ? "milestone"
        : task.isDone
          ? "done"
          : task.isActive
            ? "active"
            : "normal";
      bars.push([task.title, task.start, task.renderEnd ?? task.end, style, task.isCrit, task.link, task.clickable]);
      if (!compact) labelWidth = Math.max(labelWidth, displayWidth(task.title));
      if (task.start !== undefined && (earliest === undefined || task.start < earliest)) earliest = task.start;
      if (task.end !== undefined && (latest === undefined || task.end > latest)) latest = task.end;
    }
    grouped.push([section.lines, bars]);
    for (const line of section.lines) labelWidth = Math.max(labelWidth, displayWidth(line) + 2);
  }

  return { grouped, markers, earliest, latest, labelWidth };
}
