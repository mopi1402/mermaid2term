import { isExcludedDay, daySpellings, type Gantt, type GanttTask } from "./model.js";
import { addMonths, today, type CivilDate } from "./dates.js";
import { words } from "../../text/format.js";

const TOKEN_SPLIT_RE = /[\s,]+/;

const MAX_PUSH_DAYS = 10_000;
// The days the excludes walk takes over a whole chart, where mermaid walks every day of every task unbounded.
const MAX_SETTLE_DAYS = 200_000;

export interface SettleBudget {
  left: number;
}

export const settleBudget = (): SettleBudget => ({ left: MAX_SETTLE_DAYS });

export function endOfDuration(task: GanttTask): CivilDate | undefined {
  if (task.start === undefined) return undefined;
  if (task.durationMonths !== undefined) return addMonths(task.start, task.durationMonths);
  if (task.durationDays !== undefined) return task.start + task.durationDays;
  return undefined;
}

export function endUntil(until: string, byId: ReadonlyMap<string, GanttTask>): CivilDate | undefined {
  const named = words(until)
    .map((id) => byId.get(id))
    .filter((task): task is GanttTask => task !== undefined);
  if (named.length === 0) return today();
  let earliest: CivilDate | undefined;
  for (const task of named) {
    if (task.start === undefined) return undefined;
    if (earliest === undefined || task.start < earliest) earliest = task.start;
  }
  return earliest;
}

export function startAfter(after: string, byId: ReadonlyMap<string, GanttTask>): CivilDate | undefined {
  let latest: CivilDate | undefined;
  for (const id of words(after)) {
    const dependency = byId.get(id);
    if (dependency === undefined || dependency.end === undefined) return undefined;
    if (latest === undefined || dependency.end > latest) latest = dependency.end;
  }
  return latest;
}

export function mergeTokens(into: string[], text: string): void {
  for (const token of text.trim().toLowerCase().split(TOKEN_SPLIT_RE)) {
    if (token !== "" && !into.includes(token)) into.push(token);
  }
}

export function settleEnd(task: GanttTask, gantt: Gantt, budget: SettleBudget): void {
  task.renderEnd = undefined;
  if (task.start === undefined || task.end === undefined || gantt.excludes.length === 0 || task.manualEnd) return;
  let day = task.start + 1;
  let end = task.end;
  const ceiling = end + MAX_PUSH_DAYS;
  let invalid = false;
  let renderEnd: CivilDate | undefined;
  while (day <= end) {
    budget.left -= 1;
    if (budget.left < 0) return;
    if (!invalid) renderEnd = end;
    invalid = isExcludedDay(gantt, day, daySpellings(day, gantt.dateFormat));
    if (invalid) {
      end += 1;
      if (end > ceiling) return;
    }
    day += 1;
  }
  task.end = end;
  task.renderEnd = renderEnd;
}

