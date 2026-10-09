import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { THREE_PANES } from "../support/drawn.js";

const MINUTES_PER_DAY = 24 * 60;

interface Case {
  readonly name: string;
  readonly label: RegExp;
  readonly instant: (label: string) => number;
  readonly first: string;
  readonly last: string;
}

const CASES: readonly Case[] = [
  { name: "basic", label: /\d{4}-\d{2}-\d{2}/gu, instant: (label) => Date.parse(`${label}T00:00:00Z`) / 60000, first: "2024-01-01", last: "2024-01-22" },
  {
    name: "clock",
    label: /\d{2}:\d{2}/gu,
    instant: (label) => Number(label.slice(0, 2)) * 60 + Number(label.slice(3)),
    first: "17:49",
    last: "18:12",
  },
];

// The column a date stands on, read off the two end ticks as the chart's one column map reads it.
const columnOf = (at: number, from: number, to: number, first: number, last: number): number =>
  first + Math.trunc(((at - from) / (to - from)) * (last - first));

describe("a gantt's automatic tick names the very instant its gridline stands on", () => {
  for (const { name, label, instant, first, last } of CASES) {
    it.each(THREE_PANES)(`${name}, width %i`, (width) => {
      const rows = [...render(readFileSync(`fixtures/gantt/${name}.mmd`, "utf8"), { width }).split("\n")];
      const axisAt = rows.findIndex((row) => row.includes("└"));
      const axis = [...rows[axisAt]];
      const tees = axis.flatMap((ch, c) => (ch === "┬" ? [c] : []));
      const labels = [...rows[axisAt + 1].matchAll(label)].map((m) => ({ text: m[0], from: m.index, to: m.index + m[0].length }));
      expect(labels.length, rows.join("\n")).toBeGreaterThanOrEqual(2);
      expect(labels[0].text).toBe(first);
      expect(labels[labels.length - 1].text).toBe(last);
      const start = instant(first);
      let end = instant(last);
      if (end < start) end += MINUTES_PER_DAY;
      for (const { text, from, to } of labels) {
        const under = tees.filter((c) => c >= from && c < to);
        expect(under, `${text}\n${rows.join("\n")}`).toHaveLength(1);
        const at = columnOf(instant(text), start, end, tees[0], tees[tees.length - 1]);
        expect(under[0], `${text}\n${rows.join("\n")}`).toBe(at);
      }
    });
  }
});
