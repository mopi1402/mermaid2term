import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { watchTextClashes, type TextClash } from "../../src/canvas/canvas.js";
import { THREE_PANES } from "../support/drawn.js";

// Several labelled links joining the same two boxes each keep their label beside their own run, inside the span the
// two boxes cover, where mermaid draws each label on its own curve.
const heard: TextClash[] = [];
beforeAll(() => watchTextClashes((clash) => heard.push(clash)));
afterAll(() => watchTextClashes(undefined));

const WORDS = ["one", "two", "three", "four"];
const SECOND = ["uno", "dos", "tres", "cuatro"];

const sourceOf = (direction: string, count: number, tall: boolean): string =>
  [`flowchart ${direction}`, ...WORDS.slice(0, count).map((word, i) => `  A -->|${word}${tall ? `<br>${SECOND[i]}` : ""}| B`)].join("\n");

const WALLS = /[┌└▁▔▕]/u;

interface Seat {
  row: number;
  col: number;
}

const seatOf = (rows: readonly string[], word: string): Seat => {
  const pattern = new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, "u");
  const row = rows.findIndex((line) => pattern.test(line));
  return { row, col: row < 0 ? -1 : (pattern.exec(rows[row])?.index ?? -1) };
};

function expectBeside(direction: string, count: number, tall: boolean, width: number, padless: boolean): void {
  heard.length = 0;
  const text = render(sourceOf(direction, count, tall), padless ? { width, borders: "padless" } : { width });
  expect(heard, text).toEqual([]);
  expect(text).not.toContain("┼");
  const rows = text.split("\n");
  const framed = rows.map((line, i) => (WALLS.test(line) ? i : -1)).filter((i) => i >= 0);
  const seats = WORDS.slice(0, count).map((word) => seatOf(rows, word));
  for (const [i, seat] of seats.entries()) {
    expect(seat.row, `${WORDS[i]} in\n${text}`).toBeGreaterThanOrEqual(0);
    if (tall) expect(seatOf(rows, SECOND[i]).row, `${SECOND[i]} under ${WORDS[i]} in\n${text}`).toBe(seat.row + 1);
  }
  const across = direction === "LR" || direction === "RL";
  if (across) {
    const lines = tall ? 2 : 1;
    for (const [i, seat] of seats.entries()) {
      const run = rows[seat.row + lines] ?? "";
      const under = run.slice(seat.col, seat.col + WORDS[i].length);
      expect(under, `${WORDS[i]} above its own run in\n${text}`).toMatch(/^[─⏴⏵]*─[─⏴⏵]*$/u);
      expect(seat.row, text).toBeGreaterThanOrEqual(Math.min(...framed));
      expect(seat.row + lines, text).toBeLessThanOrEqual(Math.max(...framed));
      if (i > 0) expect(seat.row, text).toBeGreaterThan(seats[i - 1].row + lines);
    }
    return;
  }
  // Down the page the first label stands left of its run, each other right of its own, clear of the next run.
  for (const [i, seat] of seats.entries()) {
    const before = rows[seat.row].slice(0, seat.col).trimEnd();
    const after = rows[seat.row].slice(seat.col + WORDS[i].length);
    if (i === 0) {
      expect(after.trimStart().startsWith("│"), `${WORDS[i]} left of its own run in\n${text}`).toBe(true);
      expect(before.endsWith("│"), text).toBe(false);
    } else {
      expect(before.at(-1), `${WORDS[i]} right of its own run in\n${text}`).toBe("│");
      expect(after.startsWith("│"), `${WORDS[i]} clear of the next run in\n${text}`).toBe(false);
      expect(seat.col, text).toBeGreaterThan(seats[i - 1].col + WORDS[i - 1].length);
    }
  }
}

describe("labels of links joining the same two boxes", () => {
  for (const direction of ["TD", "LR", "RL", "BT"]) {
    for (const count of [2, 3, 4]) {
      for (const tall of [false, true]) {
        it(`${direction}, ${count} links, ${tall ? "two rows" : "one row"} each, beside their own run`, () => {
          for (const width of THREE_PANES) {
            expectBeside(direction, count, tall, width, false);
            expectBeside(direction, count, tall, width, true);
          }
        });
      }
    }
  }
});
