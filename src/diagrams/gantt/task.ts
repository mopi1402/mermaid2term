import { WORD_CHAR } from "../../text/format.js";
import { makeGanttTask, type GanttTask } from "./model.js";
import { engineDate, fromYMD, type CivilDate } from "./dates.js";
import { parseDayjs } from "./dayjs.js";
import { endOfDuration } from "./chain.js";
import { DAYS_PER_WEEK, HOURS_PER_DAY, MINUTES_PER_HOUR, MONTHS_PER_YEAR, MS_PER_SECOND, SECONDS_PER_MINUTE } from "./metrics.js";

export const FIELD = ":";
const SEPARATOR = ",";
const AFTER = "after ";
const UNTIL = "until ";
const MANUAL_END_RE = /^\d{4}-\d{2}-\d{2}$/;

const DONE = "done";
const ACTIVE = "active";  // keyword: mermaid's own word here, not a style key
const CRIT = "crit";  // keyword: mermaid's own word here, not a style key
const MILESTONE = "milestone";
const VERT = "vert";

const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const US_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
// CASE KEPT, exactly as mermaid reads one (`ganttDb`, 11.17.0): `m` is a minute and `M` a month, so `30m` on a
// lowercased line was read as thirty months.
const DURATION_RE = /^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/;
const ID_RE = new RegExp(String.raw`^[a-zA-Z_]${WORD_CHAR}*$`, "u");
const ID_FIELDS = 3;

const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
const SECONDS_PER_DAY = MINUTES_PER_DAY * SECONDS_PER_MINUTE;
const MILLISECONDS_PER_DAY = SECONDS_PER_DAY * MS_PER_SECOND;
const NO_DURATION = 0;

type Duration = { days: number } | { months: number };

export interface TaskContext {
  readonly dateFormat: string;
  readonly inclusive: boolean;
  // mermaid's `parseId`: a task written with fewer than three fields takes the next `task<n>`.
  readonly nextId: () => string;
}

export function parseTask(line: string, context: TaskContext): GanttTask | undefined {
  const at = line.indexOf(FIELD);
  if (at < 0) return undefined;
  const { dateFormat } = context;

  const task = makeGanttTask(line.slice(0, at).trim());
  const parts = line
    .slice(at + 1).trim()
    .split(SEPARATOR)
    .map((part) => part.trim());

  const remaining: string[] = [];
  for (const part of parts) {
    const low = part.toLowerCase();
    if (low === DONE) task.isDone = true;
    else if (low === ACTIVE) task.isActive = true;
    else if (low === CRIT) task.isCrit = true;
    else if (low === MILESTONE) task.isMilestone = true;
    else if (low === VERT) task.isVert = true;
    else remaining.push(part);
  }

  // Three fields or more: the first is the id whatever it is written with, as mermaid's `parseData` takes it.
  const named = remaining.length >= ID_FIELDS;
  if (named) task.id = remaining[0];
  const fields = named ? remaining.slice(1) : remaining;
  const startAt = fields.length >= 2 ? 0 : -1;

  const dates: Array<[CivilDate, string, boolean]> = [];
  let unread = 0;
  fields.forEach((part, index) => {
    if (part.toLowerCase().startsWith(AFTER)) {
      task.after = part.slice(AFTER.length).trim();
      return;
    }
    if (part.toLowerCase().startsWith(UNTIL)) {
      task.until = part.slice(UNTIL.length).trim();
      return;
    }

    const duration = parseDuration(part);
    if (duration !== undefined) {
      if ("months" in duration) task.durationMonths = duration.months;
      else task.durationDays = duration.days;
      return;
    }

    const strict = dateFormat === "" ? undefined : parseDayjs(part, dateFormat);
    const when = strict ?? (index === startAt ? looseDate(part) : undefined);
    if (when !== undefined) {
      dates.push([when, part, strict !== undefined]);
      return;
    }

    if (task.id === "" && ID_RE.test(part)) task.id = part;
    else unread += 1;
  });
  const hasDuration = task.durationDays !== undefined || task.durationMonths !== undefined;
  if (unread > 0 && !hasDuration && task.until === "" && dates.length < 2) task.durationDays = NO_DURATION;

  // mermaid's `getEndDate`: only a date its format reads strictly ends a task, and `inclusiveEndDates` adds a day to it.
  const setEnd = ([when, spelling, strict]: [CivilDate, string, boolean]): void => {
    task.manualEnd = MANUAL_END_RE.test(spelling);
    if (strict) task.end = context.inclusive ? when + 1 : when;
    else task.durationDays = NO_DURATION;
  };
  const [first, second] = dates;
  if (first !== undefined && second !== undefined) {
    task.start = first[0];
    setEnd(second);
  } else if (first !== undefined) {
    const lone = task.after === "" && task.durationDays === undefined && task.durationMonths === undefined && task.until === "";
    if (task.after !== "" || lone) setEnd(first);
    else task.start = first[0];
  }
  if (task.end === undefined) task.end = endOfDuration(task);

  if (!named) {
    const generated = context.nextId();
    if (task.id === "") task.id = generated;
  }

  return task;
}

// A start its format does not read goes to `new Date`, as mermaid's `getStartDate` does: ISO and US spellings are
// read here on the civil calendar, anything else by the engine's own parser.
function looseDate(text: string): CivilDate | undefined {
  const iso = ISO_RE.exec(text) ?? undefined;
  if (iso !== undefined) {
    return fromYMD(Number.parseInt(iso[1], 10), Number.parseInt(iso[2], 10), Number.parseInt(iso[3], 10));
  }
  const american = US_RE.exec(text) ?? undefined;
  if (american !== undefined) {
    return fromYMD(Number.parseInt(american[3], 10), Number.parseInt(american[1], 10), Number.parseInt(american[2], 10));
  }
  return engineDate(text);
}

function parseDuration(text: string): Duration | undefined {
  const duration = DURATION_RE.exec(text.trim()) ?? undefined;
  if (duration === undefined) return undefined;
  const value = Number.parseFloat(duration[1]);
  if (!Number.isFinite(value)) return undefined;
  switch (duration[2]) {
    case "ms":
      return { days: value / MILLISECONDS_PER_DAY };
    case "s":
      return { days: value / SECONDS_PER_DAY };
    case "m":
      return { days: value / MINUTES_PER_DAY };
    case "h":
      return { days: value / HOURS_PER_DAY };
    case "d":
      return { days: value };
    case "w":
      return { days: value * DAYS_PER_WEEK };
    case "M":
      return { months: value };
    default:
      return { months: value * MONTHS_PER_YEAR };
  }
}

