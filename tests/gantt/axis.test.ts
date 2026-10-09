import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { parseGantt } from "../../src/diagrams/gantt/parser.js";
import { parseDayjs } from "../../src/diagrams/gantt/dayjs.js";
import { strftime } from "../../src/diagrams/gantt/strftime.js";
import { displayWidth } from "../../src/text/width.js";
import { must } from "../../src/must.js";

describe("a gantt's axis written as mermaid writes it: `%Y-%m-%d` by default, `axisFormat` when the diagram names one", () => {
  const chart = (head: string): string =>
    render(`gantt\n${head}    section S\n    a :a1, 2024-01-01, 10d\n    b :after a1, 3d\n`, { width: 80 });

  it("writes the full ISO date by default, and never `Jan 01`", () => {
    const drawn = chart("    dateFormat YYYY-MM-DD\n");
    expect(drawn).toContain("2024-01-01");
    expect(drawn).toContain("2024-01-14");
    expect(drawn).not.toContain("Jan 01");
  });

  it("follows an `axisFormat`, d3's directives included", () => {
    expect(chart("    dateFormat YYYY-MM-DD\n    axisFormat %b %d\n")).toContain("Jan 01");
    expect(chart("    dateFormat YYYY-MM-DD\n    axisFormat %A %e %B\n")).toContain("Monday  1 January");
    expect(chart("    dateFormat YYYY-MM-DD\n    axisFormat %d/%m\n")).toContain("14/01");
  });

  it("writes the bare day where `dateFormat` is `D`", () => {
    const drawn = render("gantt\n    dateFormat D\n    section S\n    a :a1, 1, 5d\n", { width: 60 });
    expect(drawn).toMatch(/\b01\b/);
    expect(drawn).not.toContain("1970");
  });

  it("spaces the dates by their own width, so ten-column dates never overlap and the drawing keeps its budget", () => {
    for (const width of [40, 60, 80, 120]) {
      const drawn = render("gantt\n    dateFormat YYYY-MM-DD\n    section S\n    a :a1, 2024-01-01, 30d\n", { width });
      const rows = drawn.split("\n");
      expect(Math.max(...rows.map((row) => displayWidth(row)))).toBeLessThanOrEqual(width);
      const axis = rows[rows.length - 1];
      expect(axis.match(/\d{4}-\d{2}-\d{2}/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(axis).not.toMatch(/\d{4}-\d{2}-\d{2}\d/);
    }
  });
});

describe("a gantt's `tickInterval` steps its axis, and `weekday` says which day a week opens on", () => {
  const axis = (head: string, task = "a :a1, 2024-01-01, 28d", width = 90): string => {
    const rows = render(`gantt\n    dateFormat YYYY-MM-DD\n    axisFormat %m-%d\n${head}    section S\n    ${task}\n`, { width }).split("\n");
    return rows[rows.length - 1];
  };
  const dates = (line: string): string[] => line.match(/\d{2}-\d{2}/gu) ?? [];

  it("reads the directive off the diagram, and leaves the axis on auto where the pattern says nothing", () => {
    const read = (line: string) => parseGantt(`gantt\n    ${line}\n    a :a1, 2024-01-01, 3d\n`).tickInterval;
    expect(read("tickInterval 1week")).toEqual({ count: 1, unit: "week" });
    expect(read("tickInterval 15minute")).toEqual({ count: 15, unit: "minute" });
    expect(read("tickInterval 3fortnights")).toBeUndefined();
    expect(read("tickInterval 0day")).toBeUndefined();
    expect(read("tickInterval week")).toBeUndefined();
  });

  it("puts a week's ticks on sundays, and on the day a `weekday` line names instead", () => {
    expect(dates(axis("    tickInterval 1week\n"))).toEqual(["01-07", "01-14", "01-21", "01-28"]);
    expect(dates(axis("    tickInterval 1week\n    weekday monday\n"))).toEqual(["01-01", "01-08", "01-15", "01-22", "01-29"]);
    expect(dates(axis("    tickInterval 1week\n    weekday wednesday\n"))).toEqual(["01-03", "01-10", "01-17", "01-24"]);
  });

  it("steps by whole days, and by whole months on the calendar", () => {
    expect(dates(axis("    tickInterval 1day\n", "a :a1, 2024-01-01, 10d"))).toEqual([
      "01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08", "01-09", "01-10", "01-11",
    ]);
    expect(dates(axis("    tickInterval 2day\n", "a :a1, 2024-01-01, 10d"))).toEqual(["01-01", "01-03", "01-05", "01-07", "01-09", "01-11"]);
    expect(dates(axis("    tickInterval 2day\n", "a :a1, 2024-01-02, 9d"))).toEqual(["01-03", "01-05", "01-07", "01-09", "01-11"]);
    const even = render("gantt\n    dateFormat YYYY-MM-DD\n    axisFormat %b\n    tickInterval 2month\n    section S\n    a :a1, 2024-02-15, 300d\n", { width: 90 }).split("\n");
    expect(even[even.length - 1].match(/[A-Z][a-z]{2}/gu)).toEqual(["Mar", "May", "Jul", "Sep", "Nov"]);
    const months = render("gantt\n    dateFormat YYYY-MM-DD\n    axisFormat %b %d\n    tickInterval 1month\n    section S\n    a :a1, 2024-01-15, 120d\n", { width: 80 }).split("\n");
    for (const written of months[months.length - 1].match(/[A-Z][a-z]{2} \d{2}/gu) ?? []) {
      expect(written.endsWith("01")).toBe(true);
    }
  });

  it("lands the hours on the hour, the minutes on the minute", () => {
    const clock = (head: string, task: string): string[] => {
      const rows = render(`gantt\n    dateFormat HH:mm\n    axisFormat %H:%M\n${head}    section S\n    ${task}\n`, { width: 80 }).split("\n");
      return rows[rows.length - 1].match(/\d{2}:\d{2}/gu) ?? [];
    };
    expect(clock("    tickInterval 2hour\n", "a :a1, 08:30, 10h")).toEqual(["10:00", "12:00", "14:00", "16:00", "18:00"]);
    expect(clock("    tickInterval 15minute\n", "a :a1, 08:10, 90m")).toEqual(["08:15", "08:30", "08:45", "09:00", "09:15", "09:30"]);
  });

  it("survives a cadence finer than the chart has columns, thinning it instead of drawing for ever", () => {
    const rows = render("gantt\n    dateFormat HH:mm\n    axisFormat %H:%M\n    tickInterval 1millisecond\n    section S\n    a :a1, 08:10, 90m\n", { width: 80 }).split("\n");
    const line = rows[rows.length - 1];
    expect((line.match(/\d{2}:\d{2}/gu) ?? []).length).toBeGreaterThan(1);
    expect(displayWidth(line)).toBeLessThanOrEqual(80);
  });

  it("never writes two dates over one another, whatever the cadence", () => {
    for (const head of ["", "    tickInterval 1day\n", "    tickInterval 1week\n", "    tickInterval 1month\n"]) {
      for (const width of [40, 60, 80, 120]) {
        const line = axis(head, "a :a1, 2024-01-01, 90d", width);
        expect(line).not.toMatch(/\d{2}-\d{2}-\d{2}/u);
        expect(displayWidth(line)).toBeLessThanOrEqual(width);
      }
    }
  });
});

describe("a gantt's `axisFormat` writes every directive d3 knows, and pads it as asked", () => {
  const MOMENT = must(parseDayjs("2024-03-06 14:07:09.042", "YYYY-MM-DD HH:mm:ss.SSS"));

  it("answers the whole of mermaid's own table, not one directive left standing as written", () => {
    const table: ReadonlyArray<readonly [string, string]> = [
      ["%a", "Wed"],
      ["%A", "Wednesday"],
      ["%b", "Mar"],
      ["%B", "March"],
      ["%d", "06"],
      ["%e", " 6"],
      ["%H", "14"],
      ["%I", "02"],
      ["%j", "066"],
      ["%m", "03"],
      ["%M", "07"],
      ["%L", "042"],
      ["%p", "PM"],
      ["%S", "09"],
      ["%U", "09"],
      ["%w", "3"],
      ["%W", "10"],
      ["%y", "24"],
      ["%Y", "2024"],
      ["%Z", "+0000"],
      ["%%", "%"],
    ];
    for (const [directive, written] of table) expect(strftime(MOMENT, directive)).toBe(written);
  });

  it("expands `%x`, `%X` and `%c` as d3's own default locale does, not as the README spells them", () => {
    expect(strftime(MOMENT, "%x")).toBe("3/6/2024");
    expect(strftime(MOMENT, "%X")).toBe("2:07:09 PM");
    expect(strftime(MOMENT, "%c")).toBe("3/6/2024, 2:07:09 PM");
  });

  it("takes the pad a directive is given: `-` bare, `_` on spaces, `0` on zeroes", () => {
    expect(strftime(MOMENT, "%-m/%-d/%Y")).toBe("3/6/2024");
    expect(strftime(MOMENT, "%_d")).toBe(" 6");
    expect(strftime(MOMENT, "%0e")).toBe("06");
    expect(strftime(MOMENT, "%-j")).toBe("66");
    expect(strftime(MOMENT, "%e|%d")).toBe(" 6|06");
  });

  it("counts an ISO week off its THURSDAY, so the turn of the year belongs to the week that holds it", () => {
    const isoOf = (date: string): string => strftime(must(parseDayjs(date, "YYYY-MM-DD")), "%G-W%V-%u");
    expect(isoOf("2021-01-01")).toBe("2020-W53-5");
    expect(isoOf("2019-12-30")).toBe("2020-W01-1");
    expect(isoOf("2024-03-06")).toBe("2024-W10-3");
  });

  it("counts `%U` and `%W` from the day itself, where an offset walked off January drifted by one", () => {
    expect(strftime(must(parseDayjs("1961-10-15", "YYYY-MM-DD")), "%U")).toBe("42");
    expect(strftime(must(parseDayjs("1962-01-07", "YYYY-MM-DD")), "%W")).toBe("01");
    expect(strftime(must(parseDayjs("2024-01-01", "YYYY-MM-DD")), "%U")).toBe("00");
    expect(strftime(must(parseDayjs("2024-01-07", "YYYY-MM-DD")), "%U")).toBe("01");
  });

  it("leaves a directive d3 does not know exactly as it was written, taking no diagram down over it", () => {
    expect(strftime(MOMENT, "%v")).toBe("%v");
    expect(strftime(MOMENT, "%Y %k %m")).toBe("2024 %k 03");
  });

  it("writes the axis with the format the diagram named, and `%Y-%m-%d` where it named none", () => {
    const source = (line: string): string =>
      `gantt\n    dateFormat YYYY-MM-DD\n${line}    section S\n    Une :a1, 2024-01-08, 60d\n`;
    expect(render(source(""), { width: 60 })).toContain("2024-01-08");
    expect(render(source("    axisFormat %Y-Q%q\n"), { width: 60 })).toContain("2024-Q1");
    expect(render(source("    axisFormat %b %d\n"), { width: 60 })).toContain("Jan 08");
  });
});
