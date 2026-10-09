import { must } from "../../must.js";
import { calendarOf, fromYMD, isoWeekday as isoWeekdayOf, toYMD, type CivilDate } from "./dates.js";
import {
  DAYS_PER_WEEK,
  DAY_ABBR,
  DAY_DIGITS,
  DAY_NAMES_FULL,
  DAY_OF_YEAR_DIGITS,
  MS_PER_DAY,
  MILLIS_DIGITS,
  MINUTES_PER_HOUR,
  MONTH_ABBR,
  MONTH_NAMES,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  SHORT_YEAR,
  YEAR_DIGITS,
  HALF_DAY_HOURS,
} from "./metrics.js";

const STRFTIME_RE = /%([-_0])?([a-zA-Z%])/g;

const PADS: Readonly<Record<string, string>> = { "-": "", _: " ", "0": "0" };
const SPACE_PADDED = "e";

const padded = (value: number, fill: string, width: number): string => {
  const sign = value < 0 ? "-" : "";
  const digits = String(value < 0 ? -value : value);
  return sign + (fill === "" ? digits : digits.padStart(width, fill));
};

const LOCALE_DATE = "%-m/%-d/%Y";
const LOCALE_TIME = "%-I:%M:%S %p";
const LOCALE_DATE_TIME = "%x, %X";

const YEAR_MODULO = 10000;
const ISO_THURSDAY = 4;
const MICROS_TAIL = "000";

export function strftime(days: CivilDate, format: string): string {
  const { whole, hour: hours, minute: minutes, second: seconds, millis, year, month, day, isoWeekday, dayOfYear, quarter, hour12 } = calendarOf(days);
  const weekday = isoWeekday % DAYS_PER_WEEK;
  const january = whole - dayOfYear + 1;
  const weekOf = (firstDay: number): number => {
    const first = january + (((firstDay - (isoWeekdayOf(january) % DAYS_PER_WEEK)) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
    return whole < first ? 0 : Math.floor((whole - first) / DAYS_PER_WEEK) + 1;
  };

  const thursday = whole + (ISO_THURSDAY - isoWeekday);
  const isoYear = toYMD(thursday).year;
  const isoWeek = Math.floor((thursday - (must(fromYMD(isoYear, 1, 1)))) / DAYS_PER_WEEK) + 1;

  const epochMs = whole * MS_PER_DAY + ((hours * MINUTES_PER_HOUR + minutes) * SECONDS_PER_MINUTE + seconds) * MS_PER_SECOND + millis;

  return format.replace(STRFTIME_RE, (written, modifier: string | undefined, code: string) => {
    const fill = modifier === undefined ? (code === SPACE_PADDED ? " " : "0") : (PADS[modifier]);
    const pad = (value: number, width: number): string => padded(value, fill, width);
    switch (code) {
      case "Y": return pad(year % YEAR_MODULO, YEAR_DIGITS);
      case "y": return pad(year % SHORT_YEAR, DAY_DIGITS);
      case "m": return pad(month, DAY_DIGITS);
      case "d": return pad(day, DAY_DIGITS);
      case "e": return pad(day, DAY_DIGITS);
      case "b": return MONTH_ABBR[month - 1];
      case "B": return MONTH_NAMES[month - 1];
      case "a": return DAY_ABBR[weekday];
      case "A": return DAY_NAMES_FULL[weekday];
      case "j": return pad(dayOfYear, DAY_OF_YEAR_DIGITS);
      case "u": return String(isoWeekday);
      case "w": return String(weekday);
      case "U": return pad(weekOf(0), DAY_DIGITS);
      case "W": return pad(weekOf(1), DAY_DIGITS);
      case "V": return pad(isoWeek, DAY_DIGITS);
      case "g": return pad(isoYear % SHORT_YEAR, DAY_DIGITS);
      case "G": return pad(isoYear % YEAR_MODULO, YEAR_DIGITS);
      case "q": return String(quarter);
      case "H": return pad(hours, DAY_DIGITS);
      case "I": return pad(hour12, DAY_DIGITS);
      case "M": return pad(minutes, DAY_DIGITS);
      case "S": return pad(seconds, DAY_DIGITS);
      case "L": return pad(millis, MILLIS_DIGITS);
      case "f": return pad(millis, MILLIS_DIGITS) + MICROS_TAIL;
      case "Q": return String(epochMs);
      case "s": return String(Math.floor(epochMs / MS_PER_SECOND));
      case "p": return hours < HALF_DAY_HOURS ? "AM" : "PM";
      case "Z": return "+0000";
      case "x": return strftime(days, LOCALE_DATE);
      case "X": return strftime(days, LOCALE_TIME);
      case "c": return strftime(days, LOCALE_DATE_TIME);
      case "%": return "%";
      default: return written;
    }
  });
}

