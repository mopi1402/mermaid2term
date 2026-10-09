import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { headOf, rowsOf, TWO_PANES, widest } from "../support/drawn.js";

const LONG = "A rather long diagram title that cannot fit on a single forty column line at all, nor on eighty however it is put";
const source = (title: string): string =>
  `gantt\n title ${title}\n dateFormat YYYY-MM-DD\n section A\n task one :a1, 2024-01-01, 30d\n task two :after a1, 20d`;

describe("a gantt title wider than its budget", () => {
  it.each(TWO_PANES)("folds on words inside width %i, every word kept", (width) => {
    const drawn = render(source(LONG), { width });
    expect(widest(drawn)).toBeLessThanOrEqual(width);
    expect(headOf(drawn).map((row) => row.trim()).join(" ")).toBe(LONG);
  });

  it.each(TWO_PANES)("stays centred over the chart, right of the task names, at width %i", (width) => {
    const drawn = render(source("Plan"), { width });
    const wall = rowsOf(drawn).find((row) => row.includes("task one")) ?? "";
    const left = wall.indexOf("│");
    const right = wall.lastIndexOf("│");
    const at = rowsOf(drawn)[0].indexOf("Plan");
    expect(Math.abs(at + 2 - (left + right) / 2)).toBeLessThanOrEqual(1);
  });
});
