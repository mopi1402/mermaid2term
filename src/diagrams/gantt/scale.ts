import { displayWidth } from "../../text/width.js";
import { fromYMD, toYMD, type CivilDate } from "./dates.js";
import { must } from "../../must.js";
import { strftime } from "./strftime.js";
import type { Gantt } from "./model.js";
import type { Bar, Seated } from "./bars.js";
import { tickDemand } from "./ticks.js";
import {
  DAY_ONLY_AXIS_FORMAT,
  DAY_ONLY_DATE_FORMAT,
  DEFAULT_AXIS_FORMAT,
  LABEL_MARGIN,
  MIN_CHART_W,
  TICK_AIR,
  WIDTH_SAMPLES,
  WIDTH_WINDOW_DAYS,
} from "./metrics.js";

export interface Scale {
  readonly earliest: CivilDate;
  readonly latest: CivilDate;
  readonly span: number;
  readonly marginLeft: number;
  readonly chartWidth: number;
  readonly totalWidth: number;
  readonly drawnWidth: number;
  readonly tickPitch: number;
  readonly dateAt: (day: CivilDate) => string;
  readonly columnOf: (day: CivilDate) => number;
  readonly extentOf: (bar: Bar) => Seated | undefined;
}

const atLeast = (year: number, modulo: number, floor: number): number => {
  const rest = ((year % modulo) + modulo) % modulo;
  return rest >= floor ? year : year - rest + floor;
};

// A long span read through its two ends and its first year of four digits and a two-digit century, 28 years each.
function widestDate(dateAt: (day: CivilDate) => string, first: CivilDate, last: CivilDate): number {
  let width = 0;
  const scan = (from: CivilDate, to: CivilDate): void => {
    for (let day = Math.max(from, first); day <= Math.min(to, last); day++) width = Math.max(width, displayWidth(dateAt(day)));
  };
  if (last - first <= 3 * WIDTH_WINDOW_DAYS) {
    scan(first, last);
    return width;
  }
  scan(first, first + WIDTH_WINDOW_DAYS);
  scan(last - WIDTH_WINDOW_DAYS, last);
  const wide = must(fromYMD(atLeast(atLeast(toYMD(first).year, 10_000, 1000), 100, 10), 1, 1));
  scan(wide, wide + WIDTH_WINDOW_DAYS);
  return width;
}

export function chartScale(diagram: Gantt, earliest: CivilDate, latest: CivilDate, labelWidth: number, width: number): Scale {
  const subDaily = latest - earliest > 0 && latest - earliest < 1;
  const span = subDaily ? latest - earliest : Math.max(1, latest - earliest);

  const marginLeft = labelWidth + LABEL_MARGIN;

  const axisFormat =
    diagram.axisFormat !== ""
      ? diagram.axisFormat
      : diagram.dateFormat === DAY_ONLY_DATE_FORMAT
        ? DAY_ONLY_AXIS_FORMAT
        : DEFAULT_AXIS_FORMAT;
  const dateAt = (day: CivilDate): string => strftime(day, axisFormat);
  let dateWidth = 1;
  if (subDaily) {
    for (let i = 0; i <= WIDTH_SAMPLES; i++) {
      dateWidth = Math.max(dateWidth, displayWidth(dateAt(earliest + (i / WIDTH_SAMPLES) * span)));
    }
  } else {
    dateWidth = Math.max(dateWidth, widestDate(dateAt, Math.floor(earliest), Math.ceil(latest)));
  }
  const tickPitch = dateWidth + TICK_AIR;
  // The last date reaches half its width past its tick, so the axis stops that much short: at one less, every chart came out a column over its budget.
  const overhang = Math.max(1, dateWidth - 1 - Math.floor(dateWidth / 2));
  const room = width - marginLeft - overhang;
  const natural =
    diagram.tickInterval !== undefined
      ? tickDemand(diagram.tickInterval, earliest, latest) * tickPitch
      : subDaily
        ? room
        : (span + 1) * tickPitch;
  const chartWidth = Math.max(MIN_CHART_W, Math.floor(Math.min(room, natural)));

  const totalWidth = marginLeft + chartWidth + 1;
  const drawnWidth = totalWidth + overhang - 1;

  // The latest date on the axis's last column, where its last tick stands: bars, markers and ticks share this one map.
  const columnOf = (day: CivilDate): number => marginLeft + 1 + Math.trunc(((day - earliest) / span) * (chartWidth - 2));

  const extentOf = (bar: Bar): Seated | undefined => {
    const [, start, end, style] = bar;
    if (start === undefined || end === undefined) return undefined;
    const from = columnOf(start);
    const to = Math.max(columnOf(end), from + 1);
    if (style === "milestone") {
      const mid = Math.floor((from + to) / 2);
      return { bar, from: mid, to: mid };
    }
    return { bar, from, to: to - 1 };
  };

  return { earliest, latest, span, marginLeft, chartWidth, totalWidth, drawnWidth, tickPitch, dateAt, columnOf, extentOf };
}
