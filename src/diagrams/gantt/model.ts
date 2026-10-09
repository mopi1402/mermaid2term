import { formatDayjs } from "./dayjs.js";
import { isoWeekday, type CivilDate } from "./dates.js";
import { BR_RE } from "../../text/labels.js";

const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";

export const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type DayName = (typeof DAY_NAMES)[number];

export interface GanttTask {
  id: string;
  title: string;
  start: CivilDate | undefined;
  end: CivilDate | undefined;
  isDone: boolean;
  isActive: boolean;
  isCrit: boolean;
  isMilestone: boolean;
  isVert: boolean;
  after: string;
  until: string;
  durationDays?: number;
  durationMonths?: number;
  manualEnd: boolean;
  renderEnd: CivilDate | undefined;
  link: string | undefined;
  // Named by a `click` line, a link or a callback alike, as mermaid's `setClass(ids, "clickable")`.
  clickable: boolean;
}

type WeekendStart = "saturday" | "friday";

export const TICK_UNITS = ["millisecond", "second", "minute", "hour", "day", "week", "month"] as const;
export type TickUnit = (typeof TICK_UNITS)[number];

export interface TickInterval {
  count: number;
  unit: TickUnit;
}

export interface GanttSection {
  title: string;
  lines: string[];
  tasks: GanttTask[];
}

export interface Gantt {
  title: string;
  dateFormat: string;
  axisFormat: string;
  sections: GanttSection[];
  todayMarker: boolean;
  todayInk: string | undefined;
  topAxis: boolean;
  excludes: string[];
  includes: string[];
  weekend: WeekendStart;
  tickInterval: TickInterval | undefined;
  weekday: DayName;
}

export const makeGantt = (): Gantt => ({
  title: "",
  dateFormat: DEFAULT_DATE_FORMAT,
  axisFormat: "",
  sections: [],
  todayMarker: true,
  todayInk: undefined,
  topAxis: false,
  excludes: [],
  includes: [],
  weekend: "saturday",
  tickInterval: undefined,
  weekday: "sunday",
});

export const makeGanttSection = (title: string): GanttSection => ({
  title,
  lines: title === "" ? [] : title.split(BR_RE),
  tasks: [],
});

export const makeGanttTask = (title: string): GanttTask => ({
  id: "",
  title,
  start: undefined,
  end: undefined,
  isDone: false,
  isActive: false,
  isCrit: false,
  isMilestone: false,
  isVert: false,
  after: "",
  until: "",
  manualEnd: false,
  renderEnd: undefined,
  link: undefined,
  clickable: false,
});

const WEEKENDS = "weekends";
const WEEKEND_OPENS: Record<WeekendStart, number> = { friday: 5, saturday: 6 };
export const isoWeekdayOfName = (name: string): number | undefined => {
  const lower = name.toLowerCase();
  const at = DAY_NAMES.findIndex((day) => day === lower);
  return at < 0 ? undefined : at + 1;
};

export function daySpellings(day: CivilDate, dateFormat: string): string[] {
  const iso = formatDayjs(day, "YYYY-MM-DD");
  const declared = dateFormat === "" ? iso : formatDayjs(day, dateFormat);
  return declared === iso ? [iso] : [declared, iso];
}

export function isExcludedDay(gantt: Gantt, day: CivilDate, spellings: ReadonlyArray<string>): boolean {
  const lowered = spellings.map((spelling) => spelling.toLowerCase());
  if (lowered.some((spelling) => gantt.includes.includes(spelling))) return false;
  const weekday = isoWeekday(day);
  if (gantt.excludes.includes(WEEKENDS)) {
    const opens = WEEKEND_OPENS[gantt.weekend];
    if (weekday === opens || weekday === opens + 1) return true;
  }
  if (gantt.excludes.includes(DAY_NAMES[weekday - 1])) return true;
  return lowered.some((spelling) => gantt.excludes.includes(spelling));
}
