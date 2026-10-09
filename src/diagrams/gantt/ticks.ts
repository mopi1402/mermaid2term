import { tickStep } from "../@common/ticks.js";
import { addMonths, clockOf, fromYMD, isoWeekday, toYMD, type CivilDate } from "./dates.js";
import { isoWeekdayOfName, type DayName, type TickInterval, type TickUnit } from "./model.js";
import { DAYS_PER_WEEK, MONTHS_PER_YEAR, MS_PER_DAY } from "./metrics.js";

const TICK_UNIT_DAYS: Record<TickUnit, number> = {
  millisecond: 1 / (24 * 60 * 60 * 1000),
  second: 1 / (24 * 60 * 60),
  minute: 1 / (24 * 60),
  hour: 1 / 24,
  day: 1,
  week: 7,
  month: 0,
};

const MAX_TICK_STEPS = 10_000;

const DAYS_PER_MONTH = 30.436875;

const floorTo = (day: CivilDate, unit: number): CivilDate => (unit <= 0 ? day : Math.floor(day / unit) * unit);

function startOfMonth(day: CivilDate): CivilDate {
  const { year, month } = toYMD(Math.floor(day));
  return fromYMD(year, month, 1) ?? Math.floor(day);
}

function startOfWeek(day: CivilDate, weekday: DayName): CivilDate {
  const whole = Math.floor(day);
  const wanted = isoWeekdayOfName(weekday) ?? DAYS_PER_WEEK;
  const back = (isoWeekday(whole) - wanted + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return whole - back;
}

export function tickField(at: CivilDate, unit: TickUnit, weekday: DayName): number {
  if (unit === "week") return Math.round((startOfWeek(at, weekday) - startOfWeek(0, weekday)) / DAYS_PER_WEEK);
  const clock = clockOf(at);
  const { month, day } = toYMD(clock.whole);
  switch (unit) {
    case "month": return month - 1;
    case "day": return day - 1;
    case "hour": return clock.hour;
    case "minute": return clock.minute;
    case "second": return clock.second;
    default: return clock.millis;
  }
}

function everyStops(
  interval: TickInterval,
  weekday: DayName,
  earliest: CivilDate,
  latest: CivilDate,
  chartWidth: number
): CivilDate[] {
  const { count, unit } = interval;
  const months = unit === "month";
  const base = months
    ? startOfMonth(earliest)
    : unit === "week"
      ? startOfWeek(earliest, weekday)
      : floorTo(earliest, TICK_UNIT_DAYS[unit]);
  const held = months
    ? (latest - base) / DAYS_PER_MONTH
    : (latest - base) / TICK_UNIT_DAYS[unit];
  const walked = held <= MAX_TICK_STEPS;
  const step = walked ? 1 : count * Math.max(1, Math.ceil(held / count / Math.max(1, chartWidth)));
  const at = (k: number): CivilDate => (months ? addMonths(base, k * step) : base + k * step * TICK_UNIT_DAYS[unit]);

  const kept: CivilDate[] = [];
  for (let k = 0; ; k += 1) {
    const instant = at(k);
    if (instant > latest) break;
    if (instant >= earliest && (!walked || count === 1 || tickField(instant, unit, weekday) % count === 0)) {
      kept.push(instant);
    }
    if (kept.length > MAX_TICK_STEPS || (!walked && kept.length > chartWidth)) break;
  }
  const stride = Math.max(1, Math.ceil(kept.length / Math.max(1, chartWidth)));
  return stride === 1 ? kept : kept.filter((_, i) => i % stride === 0);
}

export function tickStops(
  interval: TickInterval,
  weekday: DayName,
  earliest: CivilDate,
  latest: CivilDate,
  chartWidth: number
): CivilDate[] {
  const kept = everyStops(interval, weekday, earliest, latest, chartWidth);
  return kept.length === 0 ? [earliest] : kept;
}

const DAYS_PER_D3_MONTH = 30;
const DAYS_PER_YEAR = 365;

// d3-time's `tickIntervals`, each a unit, a count of it and its length in days, as mermaid's time axis picks from.
const ROUND_STEPS: ReadonlyArray<readonly [TickUnit | "year", number, number]> = [
  ["second", 1, TICK_UNIT_DAYS.second],
  ["second", 5, 5 * TICK_UNIT_DAYS.second],
  ["second", 15, 15 * TICK_UNIT_DAYS.second],
  ["second", 30, 30 * TICK_UNIT_DAYS.second],
  ["minute", 1, TICK_UNIT_DAYS.minute],
  ["minute", 5, 5 * TICK_UNIT_DAYS.minute],
  ["minute", 15, 15 * TICK_UNIT_DAYS.minute],
  ["minute", 30, 30 * TICK_UNIT_DAYS.minute],
  ["hour", 1, TICK_UNIT_DAYS.hour],
  ["hour", 3, 3 * TICK_UNIT_DAYS.hour],
  ["hour", 6, 6 * TICK_UNIT_DAYS.hour],
  ["hour", 12, 12 * TICK_UNIT_DAYS.hour],
  ["day", 1, 1],
  ["day", 2, 2],
  ["week", 1, DAYS_PER_WEEK],
  ["month", 1, DAYS_PER_D3_MONTH],
  ["month", 3, 3 * DAYS_PER_D3_MONTH],
  ["year", 1, DAYS_PER_YEAR],
];

// d3's `tickInterval(start, stop, count)`: the round step nearest the span over `count`.
function roundStep(earliest: CivilDate, latest: CivilDate, count: number): readonly [TickUnit | "year", number] {
  const target = (latest - earliest) / count;
  const i = ROUND_STEPS.findIndex(([, , days]) => days > target);
  if (i === -1) return ["year", Math.max(1, Math.floor(tickStep(earliest / DAYS_PER_YEAR, latest / DAYS_PER_YEAR, count)))];
  if (i === 0) return ["millisecond", Math.max(1, Math.floor(tickStep(earliest * MS_PER_DAY, latest * MS_PER_DAY, count)))];
  const [unit, step] = ROUND_STEPS[target / ROUND_STEPS[i - 1][2] < ROUND_STEPS[i][2] / target ? i - 1 : i];
  return [unit, step];
}

// The round instants d3's time ticks stand on for about `count` ticks: whole days, Sundays, firsts of the month,
// round clock times. Under a day they are walked in whole milliseconds, a fraction of a day landing a hair off.
export function roundStops(earliest: CivilDate, latest: CivilDate, count: number, chartWidth: number): CivilDate[] {
  const [unit, step] = roundStep(earliest, latest, count);
  if (unit === "year") {
    const januaries = everyStops({ count: MONTHS_PER_YEAR, unit: "month" }, "sunday", earliest, latest, chartWidth);
    return januaries.filter((at) => toYMD(at).year % step === 0);
  }
  if (unit === "day" || unit === "week" || unit === "month") return everyStops({ count: step, unit }, "sunday", earliest, latest, chartWidth);
  const stepMs = step * Math.round(TICK_UNIT_DAYS[unit] * MS_PER_DAY);
  const last = Math.floor(Math.round(latest * MS_PER_DAY) / stepMs);
  const stops: CivilDate[] = [];
  for (let k = Math.ceil(Math.round(earliest * MS_PER_DAY) / stepMs); k <= last && stops.length <= chartWidth; k++) {
    stops.push((k * stepMs) / MS_PER_DAY);
  }
  return stops;
}

export function tickDemand(interval: TickInterval, earliest: CivilDate, latest: CivilDate): number {
  const held =
    interval.unit === "month"
      ? (latest - startOfMonth(earliest)) / DAYS_PER_MONTH
      : (latest - earliest) / TICK_UNIT_DAYS[interval.unit];
  return Math.max(1, Math.floor(held / interval.count) + 1);
}
