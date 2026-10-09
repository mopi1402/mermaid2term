import { describe, it, expect } from "vitest";
import { parseGantt } from "../../src/diagrams/gantt/parser.js";
import { fromYMD } from "../../src/diagrams/gantt/dates.js";
import { must } from "../../src/must.js";

const HEAD = "gantt\n    dateFormat YYYY-MM-DD\n";
const tasksOf = (source: string) => parseGantt(source).sections.flatMap((section) => section.tasks);
const day = (year: number, month: number, date: number): number => must(fromYMD(year, month, date));

describe("a gantt task's id, as mermaid's `parseData` and `parseId` give it", () => {
  it("takes the first of three fields whatever it is written with, a dash or a leading digit", () => {
    const tasks = tasksOf(HEAD + "    A :my-id, 2024-01-01, 3d\n    B :1, 2024-01-02, 1d\n    C :after my-id 1, 2d\n");
    expect(tasks.map((task) => task.id)).toEqual(["my-id", "1", "task1"]);
    expect(tasks[2]?.start).toBe(day(2024, 1, 4));
  });

  it("numbers the tasks written with fewer fields `task1`, `task2`, across sections", () => {
    const source = HEAD + "    section S\n    A :2024-01-01, 5d\n    B :a2, 2024-01-01, 1d\n    section T\n    C :2d\n    D :after task1 task2, 1d\n";
    const tasks = tasksOf(source);
    expect(tasks.map((task) => task.id)).toEqual(["task1", "a2", "task2", "task3"]);
    expect(tasks[3]?.start).toBe(day(2024, 1, 6));
  });

  it("starts a duration-only task where the task above it in the source ends, whatever its section", () => {
    const tasks = tasksOf(HEAD + "    section S\n    A :a1, 2024-01-01, 3d\n    section T\n    B :2d\n");
    expect([tasks[1]?.start, tasks[1]?.end]).toEqual([day(2024, 1, 4), day(2024, 1, 6)]);
  });
});

describe("`inclusiveEndDates` adds a day to an end written as a date, and to nothing else", () => {
  it("moves a date end, wherever the statement stands", () => {
    const [a, b, c] = tasksOf(HEAD + "    A :a1, 2024-01-01, 2024-01-05\n    B :b1, 2024-01-01, 3d\n    C :c1, after b1, 2024-01-10\n    inclusiveEndDates\n");
    expect(a?.end).toBe(day(2024, 1, 6));
    expect(b?.end).toBe(day(2024, 1, 4));
    expect(c?.end).toBe(day(2024, 1, 11));
  });
});

describe("dates outside the format: `new Date` reads a start, only the format reads an end", () => {
  it("reads a start spelled `January 5 2014` the way `new Date` does", () => {
    const [a] = tasksOf(HEAD + "    A :a1, January 5 2014, 3d\n");
    expect([a?.start, a?.end]).toEqual([day(2014, 1, 5), day(2014, 1, 8)]);
  });

  it("ends a task at its start when the end is a date its format does not read, as `getEndDate` does", () => {
    const [a] = tasksOf(HEAD + "    A :a1, 2014-01-02, 01/10/2014\n");
    expect([a?.start, a?.end]).toEqual([day(2014, 1, 2), day(2014, 1, 2)]);
  });

  it("still reads an ISO or US start outside the format", () => {
    const [a, b] = tasksOf("gantt\n    dateFormat DD-MM-YYYY\n    A :a1, 2014-01-02, 1d\n    B :b1, 01/03/2014, 1d\n");
    expect([a?.start, b?.start]).toEqual([day(2014, 1, 2), day(2014, 1, 3)]);
  });
});
