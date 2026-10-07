// A note's frame stands on the note's own ground: no page shows between the fill and the line drawn around it,
// which is how mermaid strokes a rect it has already filled. Measured on the ANSI, cell by cell, since the plain
// drawing says nothing about the ground.

import { describe, expect, it } from "vitest";

import { renderThemed } from "../../src/index.js";
import { stripSgr } from "../support/ansi.js";
import { paintedGrid } from "../support/grid.js";

const NONE = "";

/** The background of every cell of the drawing, row by row, as the ANSI actually paints it. */
const grounds = (ansi: string): string[][] => paintedGrid(ansi).map((row) => row.map(({ ground }) => ground));

/** The grounds of the box holding `text`, from its top rule to its bottom one, corners included. */
const boxGrounds = (source: string, text: string, borders: "default" | "padless"): string[] => {
  const painted = renderThemed(source, { width: 60, background: "light", borders }, "default");
  const plain = stripSgr(painted).split("\n");
  const rows = grounds(painted);
  const row = plain.findIndex((line) => line.includes(text));
  expect(row).toBeGreaterThan(0);
  // The walls are the first glyph on either side of the text, whatever padding the box gives it.
  const cells = [...plain[row]];
  const at = plain[row].indexOf(text);
  let from = at - 1;
  while (from > 0 && cells[from] === " ") from -= 1;
  let to = at + text.length;
  while (to < cells.length - 1 && cells[to] === " ") to += 1;
  expect(cells[from]).not.toBe(" ");
  expect(cells[to]).not.toBe(" ");
  const held: string[] = [];
  for (let r = row - 1; r <= row + 1; r++) for (let c = from; c <= to; c++) held.push(rows[r][c]);
  return held;
};

const NOTE_FILL = "#fff5ad";

describe("a note is filled up to the line drawn around it", () => {
  it("leaves no page between the fill and the frame of a state's note", () => {
    const source = "stateDiagram-v2\n  A --> B\n  note right of A : a note here";
    expect(new Set(boxGrounds(source, "a note here", "default"))).toEqual(new Set([NOTE_FILL]));
  });

  // Where the borders ride the cell edges the ground follows the ink instead of running behind every border cell:
  // a rule pushed OUT leaves its other seven eighths inside and keeps the fill, a wall pulled IN leaves them
  // outside and keeps none. Either way nothing of the page stands between the fill and the line.
  it("stops the fill ON the line where the borders ride the cell edges, never past it", () => {
    const source = "stateDiagram-v2\n  A --> B\n  note right of A : a note here";
    const painted = renderThemed(source, { width: 60, background: "light", borders: "padless" }, "default");
    const plain = stripSgr(painted).split("\n");
    const rows = grounds(painted);
    const row = plain.findIndex((line) => line.includes("a note here"));
    expect(row).toBeGreaterThan(0);
    const cells = [...plain[row]];
    const at = plain[row].indexOf("a note here");
    let left = at - 1;
    while (left > 0 && cells[left] === " ") left -= 1;
    let right = at + "a note here".length;
    while (right < cells.length - 1 && cells[right] === " ") right += 1;
    const held = new Map<string, Set<string>>();
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = left; c <= right; c++) {
        const glyph = [...plain[r]][c] ?? " ";
        held.set(glyph, (held.get(glyph) ?? new Set<string>()).add(rows[r][c]));
      }
    }
    expect(held.get("\u2594")).toEqual(new Set([NOTE_FILL]));
    expect(held.get("\u2581")).toEqual(new Set([NOTE_FILL]));
    expect(held.get("\u2595")).toEqual(new Set([NONE]));
    expect(held.get("\u258F")).toEqual(new Set([NONE]));
    for (let c = left + 1; c < right; c++) expect(rows[row][c]).toBe(NOTE_FILL);
  });

  it("does the same for a sequence note, which a renderer of its own draws", () => {
    const source = "sequenceDiagram\n  Alice->>Bob: hi\n  Note right of Bob: a note here";
    expect(new Set(boxGrounds(source, "a note here", "default"))).toEqual(new Set([NOTE_FILL]));
  });

  it("does the same for a class diagram's note, which never lost it", () => {
    const source = 'classDiagram\n  class A\n  note for A "a note here"';
    expect(new Set(boxGrounds(source, "a note here", "default"))).toEqual(new Set([NOTE_FILL]));
  });
});
