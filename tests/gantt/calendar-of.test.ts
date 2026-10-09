import { describe, it, expect } from "vitest";
import { calendarOf, fromYMD, isoWeekday } from "../../src/diagrams/gantt/dates.js";
import { must } from "../../src/must.js";

describe("calendarOf reads every calendar field off one instant", () => {
  it("gives the date, day of year, quarter, ISO weekday and 12-hour clock", () => {
    const at = must(fromYMD(2024, 12, 31)) + 13.5 / 24;
    expect(calendarOf(at)).toEqual({
      whole: must(fromYMD(2024, 12, 31)),
      hour: 13,
      minute: 30,
      second: 0,
      millis: 0,
      year: 2024,
      month: 12,
      day: 31,
      isoWeekday: 2,
      dayOfYear: 366,
      quarter: 4,
      hour12: 1,
    });
  });

  it("reads midnight as twelve o'clock and January 1 as day one", () => {
    const calendar = calendarOf(must(fromYMD(2023, 1, 1)));
    expect([calendar.hour12, calendar.dayOfYear, calendar.quarter, calendar.isoWeekday]).toEqual([12, 1, 1, 7]);
  });

  it("numbers the epoch, a Thursday, as ISO weekday 4", () => {
    expect([isoWeekday(0), isoWeekday(-1), isoWeekday(3)]).toEqual([4, 3, 7]);
  });
});
