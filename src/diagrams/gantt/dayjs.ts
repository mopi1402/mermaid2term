import { calendarOf, fromYMD, type CivilDate } from "./dates.js";
import {
  DAY_DIGITS,
  DAY_OF_YEAR_DIGITS,
  HOURS_PER_DAY,
  MILLIS_DIGITS,
  MINUTES_PER_HOUR,
  MONTH_ABBR,
  MONTH_NAMES,
  MS_PER_SECOND,
  QUARTER_MONTHS,
  SECONDS_PER_MINUTE,
  SHORT_YEAR,
  YEAR_DIGITS,
  HALF_DAY_HOURS,
} from "./metrics.js";

const CENTURY_PIVOT = 69;

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

// LONGEST FIRST inside each family, or `MMMM` reads as two `MM` and `SSS` as three `S`.
const DAYJS_TOKENS = [
  { name: "YYYY", pattern: "\\d{1,4}" },
  { name: "YY", pattern: "\\d{1,2}" },
  { name: "MMMM", pattern: "[A-Za-z]+" },
  { name: "MMM", pattern: "[A-Za-z]+" },
  { name: "MM", pattern: "\\d{1,2}" },
  { name: "M", pattern: "\\d{1,2}" },
  { name: "DDDD", pattern: "\\d{1,3}" },
  { name: "DDD", pattern: "\\d{1,3}" },
  { name: "Do", pattern: "\\d{1,2}(?:st|nd|rd|th)" },
  { name: "DD", pattern: "\\d{1,2}" },
  { name: "D", pattern: "\\d{1,2}" },
  { name: "Q", pattern: "[1-4]" },
  { name: "HH", pattern: "\\d{1,2}" },
  { name: "H", pattern: "\\d{1,2}" },
  { name: "hh", pattern: "\\d{1,2}" },
  { name: "h", pattern: "\\d{1,2}" },
  { name: "mm", pattern: "\\d{1,2}" },
  { name: "m", pattern: "\\d{1,2}" },
  { name: "ss", pattern: "\\d{1,2}" },
  { name: "s", pattern: "\\d{1,2}" },
  { name: "SSS", pattern: "\\d{3}" },
  { name: "SS", pattern: "\\d{2}" },
  { name: "S", pattern: "\\d" },
  { name: "ZZ", pattern: "[+-]\\d{4}|Z" },
  { name: "Z", pattern: "[+-]\\d{2}:?\\d{2}|Z" },
  { name: "A", pattern: "[AaPp][Mm]" },
  { name: "a", pattern: "[AaPp][Mm]" },
  { name: "X", pattern: "-?\\d+(?:\\.\\d+)?" },
  { name: "x", pattern: "-?\\d+" },
];
type DayjsTokenName = (typeof DAYJS_TOKENS)[number]["name"];

const TENTHS = 100;
const HUNDREDTHS = 10;
const MINUTES_PER_DEGREE_GROUP = 100;

function monthOfName(name: string): number | undefined {
  const lower = name.toLowerCase();
  const full = MONTH_NAMES.findIndex((month) => month.toLowerCase() === lower);
  if (full >= 0) return full + 1;
  const abbr = MONTH_ABBR.findIndex((month) => month.toLowerCase() === lower);
  return abbr >= 0 ? abbr + 1 : undefined;
}

function offsetOfZone(text: string): number {
  if (text === "Z") return 0;
  const sign = text.startsWith("-") ? -1 : 1;
  const digits = text.replace(/[^0-9]/gu, "");
  const value = Number.parseInt(digits, 10);
  return sign * (Math.floor(value / MINUTES_PER_DEGREE_GROUP) * MINUTES_PER_HOUR + (value % MINUTES_PER_DEGREE_GROUP));
}

export function parseDayjs(text: string, format: string): CivilDate | undefined {
  const read: DayjsTokenName[] = [];
  let pattern = "^";
  for (let i = 0; i < format.length; ) {
    const ch = format[i];
    if (ch === "[") {
      const close = format.indexOf("]", i + 1);
      const literal = close < 0 ? format.slice(i + 1) : format.slice(i + 1, close);
      pattern += literal.replace(ESCAPE_RE, "\\$&");
      i = close < 0 ? format.length : close + 1;
      continue;
    }
    const token = DAYJS_TOKENS.find((candidate) => format.startsWith(candidate.name, i));
    if (token !== undefined) {
      read.push(token.name);
      pattern += `(${token.pattern})`;
      i += token.name.length;
      continue;
    }
    pattern += /\s/u.test(ch) ? "\\s+" : ch.replace(ESCAPE_RE, "\\$&");
    i += 1;
  }

  let match: RegExpExecArray | undefined;
  try {
    match = new RegExp(pattern + "$", "u").exec(text) ?? undefined;
  } catch {
    return undefined;
  }
  if (match === undefined) return undefined;

  let year = 1900;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let millis = 0;
  let hour12: number | undefined;
  let afternoon = false;
  let dayOfYear: number | undefined;
  let offset = 0;
  let stamp: number | undefined;
  let unreadable = false;

  const secondsPerDay = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
  const digits = (value: string): number => Number.parseInt(value.replace(/[^0-9]/gu, ""), 10);

  read.forEach((name, i) => {
    const value = match[i + 1];
    switch (name) {
      case "YYYY": year = digits(value); break;
      case "YY": {
        const short = digits(value);
        year = short < CENTURY_PIVOT ? 2000 + short : 1900 + short;
        break;
      }
      case "MMMM":
      case "MMM": {
        const named = monthOfName(value);
        if (named === undefined) unreadable = true;
        else month = named;
        break;
      }
      case "MM":
      case "M": month = digits(value); break;
      case "Q": month = (digits(value) - 1) * QUARTER_MONTHS + 1; break;
      case "DDDD":
      case "DDD": dayOfYear = digits(value); break;
      case "Do":
      case "DD":
      case "D": day = digits(value); break;
      case "HH":
      case "H": hour = digits(value); break;
      case "hh":
      case "h": hour12 = digits(value); break;
      case "A":
      case "a": afternoon = value.toLowerCase().startsWith("p"); break;
      case "mm":
      case "m": minute = digits(value); break;
      case "ss":
      case "s": second = digits(value); break;
      case "SSS": millis = digits(value); break;
      case "SS": millis = digits(value) * HUNDREDTHS; break;
      case "S": millis = digits(value) * TENTHS; break;
      case "ZZ":
      case "Z": offset = offsetOfZone(value); break;
      case "X": stamp = Number.parseFloat(value) / secondsPerDay; break;
      case "x": stamp = digits(value) / (secondsPerDay * MS_PER_SECOND); break;
      default: break;
    }
  });

  if (unreadable) return undefined;
  if (stamp !== undefined) return stamp;
  if (hour12 !== undefined) hour = (hour12 % HALF_DAY_HOURS) + (afternoon ? HALF_DAY_HOURS : 0);

  let midnight: CivilDate | undefined;
  if (dayOfYear !== undefined) {
    const january = fromYMD(year, 1, 1);
    midnight = january === undefined ? undefined : january + dayOfYear - 1;
  } else {
    midnight = fromYMD(year, month, day);
  }
  if (midnight === undefined) return undefined;

  const seconds = (hour * MINUTES_PER_HOUR + minute) * SECONDS_PER_MINUTE + second + millis / MS_PER_SECOND;
  return midnight + seconds / secondsPerDay - offset / (HOURS_PER_DAY * MINUTES_PER_HOUR);
}

const ORDINALS = ["th", "st", "nd", "rd"];
const TEENS_FROM = 11;
const TEENS_TO = 13;
const ORDINAL_TENS = 100;
const ORDINAL_UNITS = 10;

function ordinalOf(value: number): string {
  const teen = value % ORDINAL_TENS;
  const unit = value % ORDINAL_UNITS;
  const suffix = teen >= TEENS_FROM && teen <= TEENS_TO ? ORDINALS[0] : (ORDINALS[unit] ?? ORDINALS[0]);
  return `${value}${suffix}`;
}

export function formatDayjs(days: CivilDate, format: string): string {
  const { hour, minute, second, millis, year, month, day, dayOfYear, quarter, hour12: half } = calendarOf(days);
  const secondsPerDay = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
  const two = (n: number): string => String(n).padStart(DAY_DIGITS, "0");

  let written = "";
  for (let i = 0; i < format.length; ) {
    const ch = format[i];
    if (ch === "[") {
      const close = format.indexOf("]", i + 1);
      written += close < 0 ? format.slice(i + 1) : format.slice(i + 1, close);
      i = close < 0 ? format.length : close + 1;
      continue;
    }
    const token = DAYJS_TOKENS.find((candidate) => format.startsWith(candidate.name, i));
    if (token === undefined) {
      written += ch;
      i += 1;
      continue;
    }
    i += token.name.length;
    switch (token.name) {
      case "YYYY": written += String(year).padStart(YEAR_DIGITS, "0"); break;
      case "YY": written += two(year % SHORT_YEAR); break;
      case "MMMM": written += MONTH_NAMES[month - 1]; break;
      case "MMM": written += MONTH_ABBR[month - 1]; break;
      case "MM": written += two(month); break;
      case "M": written += String(month); break;
      case "Q": written += String(quarter); break;
      case "DDDD": written += String(dayOfYear).padStart(DAY_OF_YEAR_DIGITS, "0"); break;
      case "DDD": written += String(dayOfYear); break;
      case "Do": written += ordinalOf(day); break;
      case "DD": written += two(day); break;
      case "D": written += String(day); break;
      case "HH": written += two(hour); break;
      case "H": written += String(hour); break;
      case "hh": written += two(half); break;
      case "h": written += String(half); break;
      case "A": written += hour < HALF_DAY_HOURS ? "AM" : "PM"; break;
      case "a": written += hour < HALF_DAY_HOURS ? "am" : "pm"; break;
      case "mm": written += two(minute); break;
      case "m": written += String(minute); break;
      case "ss": written += two(second); break;
      case "s": written += String(second); break;
      case "SSS": written += String(millis).padStart(MILLIS_DIGITS, "0"); break;
      case "SS": written += two(Math.floor(millis / HUNDREDTHS)); break;
      case "S": written += String(Math.floor(millis / TENTHS)); break;
      case "ZZ": written += "+0000"; break;
      case "Z": written += "+00:00"; break;
      case "X": written += String(Math.round(days * secondsPerDay)); break;
      case "x": written += String(Math.round(days * secondsPerDay * MS_PER_SECOND)); break;
      default: break;
    }
  }
  return written;
}
