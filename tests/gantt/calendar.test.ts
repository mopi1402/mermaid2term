import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { parseGantt } from "../../src/diagrams/gantt/parser.js";
import { fromYMD } from "../../src/diagrams/gantt/dates.js";
import { must } from "../../src/must.js";
import { stripSgr } from "../support/ansi.js";

describe("a gantt's `excludes`: a duration skips the excluded days, and each of them is a band down the chart", () => {
  const HEAD = "gantt\n    dateFormat YYYY-MM-DD\n    excludes weekends\n    section S\n";
  const dates = (source: string): Array<[number | undefined, number | undefined, number | undefined]> =>
    parseGantt(source).sections.flatMap((sec) => sec.tasks.map((t): [number | undefined, number | undefined, number | undefined] => [t.start, t.end, t.renderEnd]));
  const d = (y: number, m: number, day: number): number => must(fromYMD(y, m, day));

  it("pushes a `3d` opened on a Thursday to the Tuesday after the weekend, mermaid's own Active task", () => {
    expect(dates(HEAD + "    a :a1, 2014-01-09, 3d\n")).toEqual([[d(2014, 1, 9), d(2014, 1, 14), d(2014, 1, 14)]]);
  });

  it("leaves an end WRITTEN as a date where it was written, even across a weekend", () => {
    expect(dates(HEAD + "    a :a1, 2014-01-10, 2014-01-13\n")).toEqual([[d(2014, 1, 10), d(2014, 1, 13), undefined]]);
  });

  it("stops the bar before a trailing run of excluded days, the way `renderEndTime` does", () => {
    const source = HEAD + "    a :a1, 2014-01-24, 1d\n    m :milestone, isadded, 2014-01-25, 0d\n    b :after a1, until isadded\n";
    const rows = dates(source);
    expect(rows[0]).toEqual([d(2014, 1, 24), d(2014, 1, 27), d(2014, 1, 25)]);
  });

  it("does nothing without an `excludes` line, and pushes nothing when the line names no day in the span", () => {
    expect(dates("gantt\n    dateFormat YYYY-MM-DD\n    section S\n    a :a1, 2014-01-09, 3d\n")[0]?.[1]).toBe(d(2014, 1, 12));
    expect(dates(HEAD.replace("weekends", "2014-02-01") + "    a :a1, 2014-01-09, 3d\n")[0]?.[1]).toBe(d(2014, 1, 12));
  });

  it("reads a day's name, a date, and `weekend friday`", () => {
    expect(dates(HEAD.replace("weekends", "thursday") + "    a :a1, 2014-01-08, 2d\n")[0]?.[1]).toBe(d(2014, 1, 11));
    expect(dates(HEAD.replace("weekends", "2014-01-09") + "    a :a1, 2014-01-08, 2d\n")[0]?.[1]).toBe(d(2014, 1, 11));
    expect(dates(HEAD + "    weekend friday\n    a :a1, 2014-01-09, 3d\n")[0]?.[1]).toBe(d(2014, 1, 14));
  });

  it("concatenates several `excludes` lines, read in the chart's own `dateFormat`, mermaid's winter-break example", () => {
    const source =
      "gantt\n    dateFormat DD-MM-YYYY\n    excludes weekends\n    %% week 7 is winter break\n    excludes 10-02-2025 11-02-2025 12-02-2025 13-02-2025 14-02-2025\n    %% workers holiday 1 maj\n    excludes 01-05-2025\n    excludes weekdays\n    section S\n    break :a, 07-02-2025, 1d\n    may :b, 30-04-2025, 1d\n";
    const rows = dates(source);
    expect(rows[0]).toEqual([d(2025, 2, 7), d(2025, 2, 17), d(2025, 2, 8)]);
    expect(rows[1]).toEqual([d(2025, 4, 30), d(2025, 5, 2), d(2025, 5, 1)]);
    expect(parseGantt(source).excludes).toHaveLength(8);
  });

  it("lets an `includes` line win back a day `excludes` took", () => {
    expect(dates(HEAD + "    includes 2014-01-11, 2014-01-12\n    a :a1, 2014-01-09, 3d\n")[0]?.[1]).toBe(d(2014, 1, 12));
  });

  it("ends a task `until` another starts, and lets a dateless task follow one that waited on `after`", () => {
    const source =
      HEAD +
      "    a :a1, 2014-01-06, 2d\n    b :after a1, 2d\n    c :3d\n    m :milestone, isadded, 2014-01-25, 0d\n    d :until isadded\n";
    const rows = dates(source);
    expect(rows[2]?.[0]).toBe(rows[1]?.[1]);
    expect(rows[2]?.[1]).toBe(d(2014, 1, 15));
    expect(rows[4]).toEqual([d(2014, 1, 25), d(2014, 1, 25), undefined]);
  });

  it("reads a lone date, and the date after an `after`, as the END the way mermaid's table says", () => {
    const source = "gantt\n    dateFormat YYYY-MM-DD\n    section S\n    p :p, 2024-01-01, 2d\n    a :after p, 2024-01-15\n    b :2024-01-20\n";
    const rows = parseGantt(source).sections[0]?.tasks.map((t) => [t.start, t.end]);
    expect(rows?.[1]).toEqual([d(2024, 1, 3), d(2024, 1, 15)]);
    expect(rows?.[2]).toEqual([d(2024, 1, 15), d(2024, 1, 20)]);
  });

  it("washes the weekend's columns in a band of their own, cut through every section", () => {
    const source =
      "gantt\n    dateFormat YYYY-MM-DD\n    excludes weekends\n    section One\n    a :a1, 2014-01-06, 5d\n    section Two\n    b :b1, 2014-01-13, 2d\n";
    const banded = renderThemed(source, { width: 80 }, "classic");
    const plain = renderThemed(source.replace("    excludes weekends\n", ""), { width: 80 }, "classic");
    const grounds = (text: string): Set<string> => new Set(text.match(/48;2;\d+;\d+;\d+/g) ?? []);
    expect(grounds(banded).size).toBe(grounds(plain).size + 1);
    const extra = must([...grounds(banded)].find((g) => !grounds(plain).has(g)));
    const rows = banded.split("\n");
    expect(rows.filter((row) => row.includes(extra)).length).toBeGreaterThanOrEqual(4);
  });

  it("draws no band where there is no ground to wash, and the bar still stops early", () => {
    const drawn = render(HEAD + "    a :a1, 2014-01-09, 3d\n", { width: 80 });
    expect(drawn).toContain("2014-01-14");
    expect(drawn).not.toContain("@bg:");
  });
});

describe("a gantt's `vert` marker CUTS the chart, and writes its name under the axis where it can be read", () => {
  const source = [
    "gantt",
    "    dateFormat HH:mm",
    "    axisFormat %H:%M",
    "    Initial vert : vert, v1, 17:30, 2m",
    "    Task A : 3m",
    "    Task B : 8m",
    "    Final vert : vert, v2, 17:58, 4m",
  ].join("\n");

  it("names each marker on its own line under the dates, whole and unbroken", () => {
    const rows = render(source, { width: 120 }).split("\n");
    const under = rows[rows.length - 1];
    expect(under).toContain("Initial vert");
    expect(under).toContain("Final vert");
    for (const row of rows.filter((line) => /[█▇]/u.test(line))) expect(row).not.toContain("vert");
  });

  it("draws a solid line straight through the bars it crosses, footed on the axis", () => {
    const rows = render(source, { width: 120 }).split("\n");
    const bars = rows.filter((row) => /[█▇]/u.test(row));
    expect(bars.length).toBeGreaterThan(0);
    const axis = must(rows.find((row) => row.includes("└")));
    const feet = [...axis].flatMap((ch, i) => (ch === "┴" ? [i] : []));
    expect(feet.length).toBe(2);
    for (const col of feet) for (const row of bars) expect(row[col]).toBe("┃");
  });

  it("keeps a marker's column against a tick that lands on it", () => {
    const drawn = render("gantt\n    dateFormat YYYY-MM-DD\n    section S\n    a :a1, 2024-01-01, 10d\n    m :vert, m1, 2024-01-01, 0d\n", { width: 80 });
    const axis = must(drawn.split("\n").find((row) => row.includes("└")));
    expect(axis).toContain("┴");
  });

  it("stacks two names that would touch onto separate lines, never over one another", () => {
    const tight = [
      "gantt",
      "    dateFormat HH:mm",
      "    axisFormat %H:%M",
      "    Kickoff : vert, k, 09:00, 0m",
      "    Standup : vert, s, 09:02, 0m",
      "    Work : w, 09:00, 20m",
    ].join("\n");
    const rows = render(tight, { width: 80 }).split("\n");
    const named = rows.filter((row) => row.includes("Kickoff") || row.includes("Standup"));
    expect(named.length).toBe(2);
    expect(named[0]).not.toContain("Standup");
  });

  it("costs a chart with no marker nothing: no row is added under its dates", () => {
    const plain = render("gantt\n    dateFormat YYYY-MM-DD\n    section S\n    a :a1, 2024-01-01, 3d\n", { width: 80 });
    const rows = plain.split("\n");
    expect(rows[rows.length - 1]).toMatch(/\d{4}-\d{2}-\d{2}/u);
  });

  it("wears an ink of its own in a theme, bold and never the italic an edge label wears", () => {
    const line = must(renderThemed(source, { width: 120 }, "neon")
      .split("\n")
      .find((row) => stripSgr(row).includes("Final vert")));
    expect(line).toBeDefined();
    const run = /\x1b\[([0-9;]*)mF/u.exec(line) ?? undefined;
    expect(run).not.toBeUndefined();
    const codes = ((must(run))[1]).split(";");
    expect(codes).toContain("1");
    expect(codes).not.toContain("3");
  });
});
