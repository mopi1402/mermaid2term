import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const WEEKLY =
  "gantt\n    dateFormat YYYY-MM-DD\n    tickInterval 1week\n    weekday monday\n" +
  "    section A\n        Posts :p, 2026-03-04, 5d\n        Drive :d, after p, 3w\n";
const DAILY = "gantt\n    dateFormat YYYY-MM-DD\n    section A\n        One :a, 2024-01-01, 6d\n        Two :b, after a, 6d\n";

describe("the gridline of a gantt's first tick", () => {
  it("is drawn when that tick stands past the chart's first date, a weekly one on a Monday", () => {
    const rows = render(WEEKLY, { width: 100 }).split("\n");
    const axis = rows.findIndex((row) => row.includes("└"));
    const firstTee = rows[axis].indexOf("┬");
    const above = rows.slice(0, axis).filter((row) => row.includes("Posts") || row.includes("A "));
    expect(above.length).toBeGreaterThan(0);
    for (const row of above) expect([...row][firstTee]).toMatch(/[│█]/u);
  });

  it("is the left wall itself when the tick stands on the first date, never a second line beside it", () => {
    expect(render(DAILY, { width: 80 })).not.toContain("││");
  });
});
