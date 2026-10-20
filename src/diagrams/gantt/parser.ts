import {
  DAY_NAMES,
  makeGantt,
  makeGanttSection,
  type Gantt,
  type GanttSection,
  type GanttTask,
  TICK_UNITS,
} from "./model.js";
import { SECTION_WORD, TITLE_WORD, contentLines, headerBody, keywordRest } from "../../source/lines.js";
import { openedIn } from "../@common/sections.js";
import { endOfDuration, endUntil, mergeTokens, settleBudget, settleEnd, startAfter } from "./chain.js";
import { FIELD, parseTask } from "./task.js";
import { withoutAccessible } from "../@common/accessible.js";
import { readClick, readTodayMarker } from "./statements.js";
import { must, oneOf } from "../../must.js";
import { flagOf, type Declared } from "../../source/config.js";

const HEADER_RE = /^gantt/u;
const DATE_FORMAT = "dateformat";
const AXIS_FORMAT = "axisformat";
const EXCLUDES = "excludes";
const INCLUDES = "includes";
const WEEKEND = "weekend";
const WEEKEND_FRIDAY = "friday";
const TICK_INTERVAL = "tickinterval";
const WEEKDAY = "weekday";
const TODAY_MARKER = "todaymarker";
const TICK_INTERVAL_RE = /^([1-9][0-9]*)(millisecond|second|minute|hour|day|week|month)$/;
const INCLUSIVE_RE = /^inclusiveenddates\b/iu;
const TOP_AXIS_RE = /^topaxis\b/iu;
const TOP_AXIS_KEY = "topAxis";
// mermaid's `taskData` is `:[^#\n;]+`: a colon followed by `#` stops the lexer, so `style a1 fill:#f00` and
// `classDef x fill:#0f0` throw there and carry nothing to draw here.
const THROWING_DATA_RE = /^[^:]*:\s*#/u;
const GENERATED_ID = "task";
// `axisFormat`, `tickInterval` and `weekday` are statements and config keys alike in mermaid. The config is
// read first and the statement over it, which is the order mermaid applies them in: the body has the last word.
function configured(gantt: Gantt, said: Declared): void {
  const format = said["axisFormat"];
  if (format !== undefined) gantt.axisFormat = format;
  const ticked = TICK_INTERVAL_RE.exec((said["tickInterval"] ?? "").toLowerCase()) ?? undefined;
  if (ticked !== undefined) {
    gantt.tickInterval = { count: Number.parseInt(ticked[1], 10), unit: must(oneOf(TICK_UNITS, ticked[2])) };
  }
  const day = oneOf(DAY_NAMES, (said["weekday"] ?? "").toLowerCase());
  if (day !== undefined) gantt.weekday = day;
  if (flagOf(said, TOP_AXIS_KEY) === true) gantt.topAxis = true;
}

export function parseGantt(text: string, said: Declared = {}): Gantt {
  const lines = contentLines(text);
  const gantt = makeGantt();
  configured(gantt, said);
  if (lines.length === 0) return gantt;

  let section: GanttSection | undefined;
  const byId = new Map<string, GanttTask>();
  const follows = new Map<GanttTask, GanttTask>();
  let previous: GanttTask | undefined;
  let taskCount = 0;
  const budget = settleBudget();
  let generated = 0;
  // The header line's own statement, `gantt title X`, which mermaid's lexer reads after the keyword.
  const body = withoutAccessible(headerBody(lines, HEADER_RE));
  const inclusive = body.some((line) => INCLUSIVE_RE.test(line));
  const nextId = (): string => `${GENERATED_ID}${(generated += 1)}`;

  for (const stripped of body) {
    if (readClick(stripped, byId)) continue;

    const lower = stripped.toLowerCase();
    const title = keywordRest(stripped, TITLE_WORD);
    if (title !== undefined) {
      gantt.title = title.trim();
      continue;
    }

    const dateFormat = keywordRest(stripped, DATE_FORMAT);
    if (dateFormat !== undefined) {
      gantt.dateFormat = dateFormat.trim();
      continue;
    }

    const axisFormat = keywordRest(stripped, AXIS_FORMAT);
    if (axisFormat !== undefined) {
      gantt.axisFormat = axisFormat.trim();
      continue;
    }

    if (INCLUSIVE_RE.test(stripped)) continue;
    if (TOP_AXIS_RE.test(stripped)) {
      gantt.topAxis = true;
      continue;
    }

    const excludes = keywordRest(stripped, EXCLUDES);
    if (excludes !== undefined) {
      mergeTokens(gantt.excludes, excludes);
      continue;
    }
    const includes = keywordRest(stripped, INCLUDES);
    if (includes !== undefined) {
      mergeTokens(gantt.includes, includes);
      continue;
    }
    const weekend = keywordRest(lower, WEEKEND);
    if (weekend !== undefined) {
      gantt.weekend = weekend.trim() === WEEKEND_FRIDAY ? "friday" : "saturday";
      continue;
    }
    const tickInterval = keywordRest(lower, TICK_INTERVAL);
    if (tickInterval !== undefined) {
      const named = TICK_INTERVAL_RE.exec(tickInterval.trim()) ?? undefined;
      if (named !== undefined) {
        gantt.tickInterval = { count: Number.parseInt(named[1], 10), unit: must(oneOf(TICK_UNITS, named[2])) };
      }
      continue;
    }
    const weekday = keywordRest(lower, WEEKDAY);
    if (weekday !== undefined) {
      const day = oneOf(DAY_NAMES, weekday.trim());
      if (day !== undefined) gantt.weekday = day;
      continue;
    }

    const todayMarker = keywordRest(stripped, TODAY_MARKER);
    if (todayMarker !== undefined) {
      const { shown, ink } = readTodayMarker(todayMarker);
      gantt.todayMarker = shown;
      gantt.todayInk = ink;
      continue;
    }

    const sectionName = keywordRest(stripped, SECTION_WORD);
    if (sectionName !== undefined) {
      section = makeGanttSection(sectionName.trim());
      gantt.sections.push(section);
      continue;
    }

    if (!stripped.includes(FIELD) || THROWING_DATA_RE.test(stripped)) continue;
    const task = parseTask(stripped, { dateFormat: gantt.dateFormat, inclusive, nextId });
    if (task === undefined) continue;
    settleEnd(task, gantt, budget);

    section = openedIn(gantt.sections, section, () => makeGanttSection(""));

    // mermaid's `prevTaskId`: the task above in the source, whatever section it stands in.
    if (task.start === undefined && task.after === "" && previous !== undefined) follows.set(task, previous);
    previous = task;

    section.tasks.push(task);
    taskCount += 1;
    byId.set(task.id, task);
  }

  for (let pass = 0; pass < taskCount + 1; pass++) {
    let changed = false;
    for (const sec of gantt.sections) {
      for (const task of sec.tasks) {
        if (task.start === undefined) {
          const start = task.after !== "" ? startAfter(task.after, byId) : (follows.get(task)?.end ?? undefined);
          if (start === undefined) continue;
          task.start = start;
          changed = true;
        }
        if (task.end !== undefined) continue;
        const end = task.until !== "" ? endUntil(task.until, byId) : endOfDuration(task);
        if (end === undefined) continue;
        task.end = end;
        settleEnd(task, gantt, budget);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return gantt;
}

