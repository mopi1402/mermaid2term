import { describe, it, expect } from "vitest";
import { declaredType, render } from "../../src/index.js";
import { parseGantt } from "../../src/diagrams/gantt/parser.js";
import { formatDayjs } from "../../src/diagrams/gantt/dayjs.js";
import { strftime } from "../../src/diagrams/gantt/strftime.js";
import { fromYMD } from "../../src/diagrams/gantt/dates.js";
import { must } from "../../src/must.js";

describe("a gantt duration read exactly as mermaid reads one: eight suffixes, case kept, months by the calendar", () => {
  const at = (length: string): [number | undefined, number | undefined] => {
    const t = parseGantt(`gantt\n    dateFormat YYYY-MM-DD\n    t :2024-01-31, ${length}\n`).sections[0]?.tasks[0];
    return [t?.start ?? undefined, t?.end ?? undefined];
  };
  const jan31 = must(fromYMD(2024, 1, 31));

  it("reads `30m` as thirty MINUTES and `1M` as one month, no longer lowercasing the line", () => {
    expect(at("30m")[1]).toBeCloseTo(jan31 + 30 / (24 * 60), 6);
    expect(at("1M")[1]).toBe(fromYMD(2024, 2, 29));
  });

  it("holds a month's end back to the days the month has, and drops the fraction of a month", () => {
    expect(at("1.5M")[1]).toBe(fromYMD(2024, 2, 29));
    expect(at("13M")[1]).toBe(fromYMD(2025, 2, 28));
  });

  it("counts a year as twelve months, so `1.5y` is eighteen of them", () => {
    expect(at("1y")[1]).toBe(fromYMD(2025, 1, 31));
    expect(at("1.5y")[1]).toBe(fromYMD(2025, 7, 31));
  });

  it("reads milliseconds, seconds and hours as their share of a day, days and weeks whole", () => {
    expect(at("500ms")[1]).toBeCloseTo(jan31 + 0.5 / 86400, 8);
    expect(at("30s")[1]).toBeCloseTo(jan31 + 30 / 86400, 8);
    expect(at("4h")[1]).toBeCloseTo(jan31 + 4 / 24, 8);
    expect(at("3d")[1]).toBe(fromYMD(2024, 2, 3));
    expect(at("2w")[1]).toBe(fromYMD(2024, 2, 14));
  });

  it("gives a task whose duration it cannot read NO duration, `3dX` and the spelled `1 month` alike", () => {
    expect(at("3dX")).toEqual([jan31, jan31]);
    expect(at("1 month")).toEqual([jan31, jan31]);
  });

  it("ends a task `until b c` where the EARLIEST of the two starts, mermaid's own example", () => {
    const source =
      "gantt\n    apple :a, 2017-07-20, 1w\n    banana :crit, b, 2017-07-23, 1d\n    cherry :active, c, after b a, 1d\n    kiwi   :d, 2017-07-20, until b c\n";
    const tasks = parseGantt(source).sections[0]?.tasks ?? [];
    expect(tasks.map((t) => [t.start, t.end])).toEqual([
      [fromYMD(2017, 7, 20), fromYMD(2017, 7, 27)],
      [fromYMD(2017, 7, 23), fromYMD(2017, 7, 24)],
      [fromYMD(2017, 7, 27), fromYMD(2017, 7, 28)],
      [fromYMD(2017, 7, 20), fromYMD(2017, 7, 23)],
    ]);
  });
});

describe("a gantt told the time keeps it: a clock `dateFormat` draws inside the day instead of collapsing", () => {
  const source = [
    "gantt",
    "    dateFormat HH:mm",
    "    axisFormat %H:%M",
    "    Initial milestone : milestone, m1, 17:49, 2m",
    "    Task A : 10m",
    "    Task B : 5m",
    "    Final milestone : milestone, m2, 18:08, 4m",
  ].join("\n");

  const times = (drawn: string): string[] => (must(drawn.split("\n").pop())).match(/\d{2}:\d{2}/g) ?? [];

  it("reads the clock off the line, to the minute, and chains the durations from it", () => {
    const tasks = parseGantt(source).sections.flatMap((section) => section.tasks);
    const at = (hour: number, minute: number): number => (hour * 60 + minute) / (24 * 60);
    const start = must(tasks[0]?.start);
    expect(start - Math.floor(start)).toBeCloseTo(at(17, 49), 9);
    expect((must(tasks[1]?.end)) - (must(tasks[1]?.start))).toBeCloseTo(at(0, 10), 9);
    expect((must(tasks[3]?.start)) - start).toBeCloseTo(at(0, 19), 9);
  });

  it("writes the minute it was given, never the one below it: 18:08 is not 18:07", () => {
    expect(strftime(must(parseGantt(source).sections[0]?.tasks[3]?.start), "%H:%M")).toBe("18:08");
  });

  it("spreads the bars across the chart instead of stacking them on one column", () => {
    const rows = render(source, { width: 100 }).split("\n");
    const barAt = (name: string): number => (must(rows.find((row) => row.includes(name)))).search(/[█◆]/u);
    expect(barAt("Task A")).toBeLessThan(barAt("Task B"));
    expect(barAt("Initial milestone")).toBeLessThan(barAt("Final milestone"));
    expect(new Set([barAt("Initial milestone"), barAt("Task A"), barAt("Task B"), barAt("Final milestone")]).size).toBe(4);
  });

  it("writes the times themselves on the axis, its ends the chart's own", () => {
    const written = times(render(source, { width: 100 }));
    expect(written.length).toBeGreaterThan(2);
    expect(written[0]).toBe("17:49");
    expect(written[written.length - 1]).toBe("18:12");
  });

  it("never writes the same thing on two NEIGHBOURING ticks, whatever the span", () => {
    const spans: ReadonlyArray<readonly [string, RegExp]> = [
      [source, /\d{2}:\d{2}/gu],
      ["gantt\n    dateFormat HH:mm\n    axisFormat %H:%M\n    A :a, 00:00, 12h\n    B :12h\n", /\d{2}:\d{2}/gu],
      ["gantt\n    dateFormat YYYY-MM-DD\n    section S\n    a :a1, 2024-01-01, 30d\n", /\d{4}-\d{2}-\d{2}/gu],
      ["gantt\n    dateFormat YYYY-MM-DD\n    axisFormat %b %d\n    section S\n    a :a1, 2024-01-01, 3d\n", /[A-Z][a-z]{2} \d{2}/gu],
    ];
    for (const [chart, shape] of spans) {
      for (const width of [40, 60, 80, 120]) {
        const written = (must(render(chart, { width }).split("\n").pop())).match(shape) ?? [];
        expect(written.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < written.length; i++) expect(written[i]).not.toBe(written[i - 1]);
      }
    }
  });

  it("keeps a chart of exactly one day off two identical ends", () => {
    const written = times(render("gantt\n    dateFormat HH:mm\n    axisFormat %H:%M\n    A :a, 00:00, 12h\n    B :12h\n", { width: 80 }));
    expect(written.length).toBeGreaterThan(2);
    expect(written).toContain("12:00");
  });
});

describe("a gantt's `dateFormat` reads every dayjs token, and an unreadable one costs the dates and never the chart", () => {
  const readAt = (format: string, text: string): number | undefined => {
    const task = parseGantt(`gantt\n    dateFormat ${format}\n    a :a1, ${text}, 1d\n`).sections[0]?.tasks[0];
    return task?.start ?? undefined;
  };
  const shown = (format: string, text: string, as = "%Y-%m-%d %H:%M:%S.%L"): string | undefined => {
    const at = readAt(format, text);
    return at === undefined ? undefined : strftime(at, as);
  };

  it("reads a month by name, short and long alike", () => {
    expect(shown("MMM D YYYY", "Mar 5 2024")).toBe("2024-03-05 00:00:00.000");
    expect(shown("MMMM D YYYY", "March 5 2024")).toBe("2024-03-05 00:00:00.000");
    expect(shown("D MMM YYYY", "5 mar 2024")).toBe("2024-03-05 00:00:00.000");
    expect(readAt("MMM D YYYY", "Nonesuch 5 2024")).toBeUndefined();
  });

  it("reads the day with its ordinal, and the day of the YEAR", () => {
    expect(shown("Do MMM YYYY", "5th Mar 2024")).toBe("2024-03-05 00:00:00.000");
    expect(shown("Do MMM YYYY", "21st Mar 2024")).toBe("2024-03-21 00:00:00.000");
    expect(shown("YYYY-DDD", "2024-065")).toBe("2024-03-05 00:00:00.000");
  });

  it("reads a quarter as the month it opens on, and takes `[text]` literally", () => {
    expect(shown("YYYY-[Q]Q", "2024-Q2")).toBe("2024-04-01 00:00:00.000");
    expect(shown("YYYY-[Q]Q", "2024-Q4")).toBe("2024-10-01 00:00:00.000");
  });

  it("reads the twelve-hour clock with its meridiem, and the fractions of a second", () => {
    expect(shown("hh:mm A", "05:49 PM", "%H:%M")).toBe("17:49");
    expect(shown("h:mm a", "5:49 pm", "%H:%M")).toBe("17:49");
    expect(shown("h:mm a", "5:49 am", "%H:%M")).toBe("05:49");
    expect(shown("h:mm a", "12:30 am", "%H:%M")).toBe("00:30");
    expect(shown("HH:mm:ss.SSS", "17:49:30.250", "%H:%M:%S.%L")).toBe("17:49:30.250");
    expect(shown("HH:mm:ss.S", "17:49:30.2", "%H:%M:%S.%L")).toBe("17:49:30.200");
  });

  it("reads a unix stamp, in seconds and in milliseconds", () => {
    expect(shown("X", "1709596800")).toBe("2024-03-05 00:00:00.000");
    expect(shown("x", "1709596800000")).toBe("2024-03-05 00:00:00.000");
  });

  it("carries a written UTC offset back to UTC, and takes an unbracketed letter literally", () => {
    expect(shown("YYYY-MM-DDTHH:mmZ", "2024-03-05T17:49+01:00", "%H:%M")).toBe("16:49");
    expect(shown("YYYY-MM-DDTHH:mmZ", "2024-03-05T17:49Z", "%H:%M")).toBe("17:49");
  });

  it("NEVER throws: a token written twice, and a format it cannot read at all, still draw their chart", () => {
    expect(() => readAt("MM-MM", "03-03")).not.toThrow();
    expect(() => readAt("MMMMMMM", "xxx")).not.toThrow();
    expect(readAt("nawak", "nawak")).toBeUndefined();
    const drawn = render("gantt\n    title T\n    dateFormat nawak\n    section S\n    a :a1, 2024-03-05, 3d\n", { width: 70 });
    expect(drawn).toContain("2024-03-05");
  });

  it("writes back every token it reads, so an `excludes` can name a day in the diagram's own format", () => {
    for (const [format, text] of [
      ["YYYY-MM-DD", "2024-03-05"],
      ["MMM D YYYY", "Mar 5 2024"],
      ["MMMM D YYYY", "March 5 2024"],
      ["Do MMM YYYY", "5th Mar 2024"],
      ["hh:mm A", "05:49 PM"],
      ["HH:mm:ss.SSS", "17:49:30.250"],
      ["YYYY-[Q]Q", "2024-Q2"],
    ]) {
      const at = readAt(format, text);
      expect(at).not.toBeUndefined();
      expect(formatDayjs(must(at), format)).toBe(text === "2024-Q2" ? "2024-Q2" : text);
    }
  });

  it("excludes a day named in a format that says its month by name", () => {
    const source = [
      "gantt",
      "    dateFormat DD-MMM-YYYY",
      "    excludes 06-Mar-2024",
      "    section S",
      "    a :a1, 05-Mar-2024, 3d",
    ].join("\n");
    const task = parseGantt(source).sections[0]?.tasks[0];
    expect(strftime(must(task?.end), "%Y-%m-%d")).toBe("2024-03-09");
  });
});

describe("a gantt ignores a comment LINE wherever it stands, above its header as well as inside it", () => {
  const BODY = [
    "gantt",
    "    title A Gantt Diagram",
    "    dateFormat YYYY-MM-DD",
    "    section Section",
    "        A task          :a1, 2014-01-01, 30d",
    "        Another task    :after a1, 20d",
    "    section Another",
    "        Task in Another :2014-01-12, 12d",
    "        another task    :24d",
    "",
  ].join("\n");
  const commented = (...at: number[]): string => {
    const lines = BODY.split("\n");
    for (const line of [...at].sort((a, b) => b - a)) lines.splice(line, 0, "    %% This is a comment");
    return lines.join("\n");
  };

  it("draws the doc's own example exactly as it draws it with the comment line taken out", () => {
    expect(render(commented(2), { width: 80 })).toBe(render(BODY, { width: 80 }));
  });

  it("finds the diagram under a comment written ABOVE the header, where the type is read", () => {
    const above = `%% a note about this plan\n${BODY}`;
    expect(declaredType(above)).toBe("gantt");
    expect(render(above, { width: 80 })).toBe(render(BODY, { width: 80 }));
    expect(render(above, { width: 80 })).not.toContain("┌");
  });

  it("swallows any diagram syntax written after the `%%`, which is what the comment is for", () => {
    const ghost = BODY.replace(
      "    section Another",
      "    %% section Ghost\n    %% Ghost task :g1, 2014-01-01, 90d\n    section Another"
    );
    expect(render(ghost, { width: 80 })).toBe(render(BODY, { width: 80 }));
  });

  it("keeps taking a comment on every line it stands on, the header's own neighbours included", () => {
    expect(render(commented(1, 3, 6), { width: 80 })).toBe(render(BODY, { width: 80 }));
  });
});
