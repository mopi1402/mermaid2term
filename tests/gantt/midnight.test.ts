import { describe, it, expect } from "vitest";
import { clockOf, fromYMD } from "../../src/diagrams/gantt/dates.js";
import { formatDayjs } from "../../src/diagrams/gantt/dayjs.js";
import { strftime } from "../../src/diagrams/gantt/strftime.js";
import { tickField } from "../../src/diagrams/gantt/ticks.js";
import { must } from "../../src/must.js";

describe("a gantt instant a hair under midnight is midnight of the NEXT day, wherever the clock is read", () => {
  const mar5 = must(fromYMD(2024, 3, 5));
  const almostMidnight = mar5 + 1 - 1e-9;

  it("decomposes to hour zero of the next day, never to hour 24 of this one", () => {
    expect(clockOf(almostMidnight)).toEqual({ whole: mar5 + 1, hour: 0, minute: 0, second: 0, millis: 0 });
  });

  it("writes 00:00 on the 6th through formatDayjs", () => {
    expect(formatDayjs(almostMidnight, "YYYY-MM-DD HH:mm:ss.SSS")).toBe("2024-03-06 00:00:00.000");
  });

  it("writes 00:00 on the 6th through strftime", () => {
    expect(strftime(almostMidnight, "%Y-%m-%d %H:%M:%S.%L")).toBe("2024-03-06 00:00:00.000");
  });

  it("reads hour 0, minute 0, second 0 and millisecond 0 off the tick field", () => {
    expect(tickField(almostMidnight, "hour", "monday")).toBe(0);
    expect(tickField(almostMidnight, "minute", "monday")).toBe(0);
    expect(tickField(almostMidnight, "second", "monday")).toBe(0);
    expect(tickField(almostMidnight, "millisecond", "monday")).toBe(0);
    expect(tickField(almostMidnight, "day", "monday")).toBe(5);
  });

  it("still reads an ordinary afternoon as it is", () => {
    const at = mar5 + (17 * 60 + 49) / (24 * 60) + 30.25 / 86400;
    expect(clockOf(at)).toEqual({ whole: mar5, hour: 17, minute: 49, second: 30, millis: 250 });
  });
});
