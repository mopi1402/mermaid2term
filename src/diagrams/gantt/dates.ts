import { must } from "../../must.js";
import { DAYS_PER_WEEK, MINUTES_PER_HOUR, MONTHS_PER_YEAR, MS_PER_DAY, MS_PER_SECOND, HALF_DAY_HOURS, QUARTER_MONTHS, SECONDS_PER_MINUTE } from "./metrics.js";

const DAYS_PER_ERA = 146097;
const YEARS_PER_ERA = 400;
const EPOCH_SHIFT = 719468;
const MARCH = 3;

export type CivilDate = number;

interface YearMonthDay {
  year: number;
  month: number;
  day: number;
}

export function fromYMD(year: number, month: number, day: number): CivilDate | undefined {
  if (month < 1 || month > MONTHS_PER_YEAR || day < 1 || day > daysInMonth(year, month)) return undefined;
  return daysFromCivil(year, month, day);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

const isLeap = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

function daysFromCivil(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / YEARS_PER_ERA);
  const yoe = y - era * YEARS_PER_ERA;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * DAYS_PER_ERA + doe - EPOCH_SHIFT;
}

export function toYMD(days: CivilDate): YearMonthDay {
  const z = days + EPOCH_SHIFT;
  const era = Math.floor(z / DAYS_PER_ERA);
  const doe = z - era * DAYS_PER_ERA;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * YEARS_PER_ERA;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? MARCH : -9);
  return { year: y + (month <= 2 ? 1 : 0), month, day };
}

const MS_PER_HOUR = MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;

interface Clock {
  whole: CivilDate;
  hour: number;
  minute: number;
  second: number;
  millis: number;
}

// Rounded to the millisecond before anything is read off it, and a round-up to a full day carries into the next one.
export function clockOf(days: CivilDate): Clock {
  let whole = Math.floor(days);
  let totalMs = Math.round((days - whole) * MS_PER_DAY);
  if (totalMs >= MS_PER_DAY) {
    whole += 1;
    totalMs -= MS_PER_DAY;
  }
  return {
    whole,
    hour: Math.floor(totalMs / MS_PER_HOUR),
    minute: Math.floor(totalMs / MS_PER_MINUTE) % MINUTES_PER_HOUR,
    second: Math.floor(totalMs / MS_PER_SECOND) % SECONDS_PER_MINUTE,
    millis: totalMs % MS_PER_SECOND,
  };
}

const EPOCH_ISO_WEEKDAY = 4;

export const isoWeekday = (day: CivilDate): number =>
  ((((Math.floor(day) + EPOCH_ISO_WEEKDAY - 1) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK) + 1;

interface Calendar extends Clock, YearMonthDay {
  isoWeekday: number;
  dayOfYear: number;
  quarter: number;
  hour12: number;
}

export function calendarOf(days: CivilDate): Calendar {
  const clock = clockOf(days);
  const ymd = toYMD(clock.whole);
  const half = clock.hour % HALF_DAY_HOURS;
  return {
    ...clock,
    ...ymd,
    isoWeekday: isoWeekday(clock.whole),
    dayOfYear: clock.whole - must(fromYMD(ymd.year, 1, 1)) + 1,
    quarter: Math.floor((ymd.month - 1) / QUARTER_MONTHS) + 1,
    hour12: half === 0 ? HALF_DAY_HOURS : half,
  };
}

export function today(): CivilDate {
  const now = new Date();
  return daysFromCivil(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addMonths(days: CivilDate, months: number): CivilDate {
  const whole = Math.trunc(months);
  const { year, month, day } = toYMD(Math.floor(days));
  const index = year * MONTHS_PER_YEAR + (month - 1) + whole;
  const newYear = Math.floor(index / MONTHS_PER_YEAR);
  const newMonth = index - newYear * MONTHS_PER_YEAR + 1;
  return daysFromCivil(newYear, newMonth, Math.min(day, daysInMonth(newYear, newMonth))) + (days - Math.floor(days));
}

const ENGINE_YEAR_LIMIT = 10_000;

// `new Date` on a spelling no format read, on the local clock, beyond 10,000 years refused as mermaid refuses it.
export function engineDate(text: string): CivilDate | undefined {
  const parsed = new Date(text);
  const time = parsed.getTime();
  if (Number.isNaN(time) || Math.abs(parsed.getFullYear()) > ENGINE_YEAR_LIMIT) return undefined;
  const day = daysFromCivil(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  const ms = ((parsed.getHours() * MINUTES_PER_HOUR + parsed.getMinutes()) * SECONDS_PER_MINUTE + parsed.getSeconds()) * MS_PER_SECOND + parsed.getMilliseconds();
  return day + ms / MS_PER_DAY;
}
