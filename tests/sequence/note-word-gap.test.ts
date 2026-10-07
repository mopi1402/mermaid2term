import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { type BorderMode, BORDER_MODES } from "../../src/options.js";
import { paintedCells, REVERSE } from "../support/grid.js";

const SOURCE = `sequenceDiagram
  participant A
  participant B
  Note over A,B: Status check
  A->>B: go`;

// Each cell of a row with the ground it wears: a true colour, reverse video, or none.
const grounds = (row: string): Array<{ ch: string; ground: string }> =>
  paintedCells(row).map(({ ch, ground, reverse }) => ({ ch, ground: ground !== "" || !reverse ? ground : REVERSE }));

describe("a sequence note's blank between two words", () => {
  for (const borders of BORDER_MODES) {
    for (const theme of ["dracula", "default", "mono"]) {
      it(`wears the note's ground, ${borders}, ${theme}`, () => {
        const row = renderThemedText(SOURCE, { width: 80, borders }, theme)
          .toAnsi()
          .split("\n")
          .find((line) => line.includes("Status")) ?? "";
        const cells = grounds(row);
        const text = cells.map(({ ch }) => ch).join("");
        const gap = text.indexOf("Status") + "Status".length;
        expect(text.slice(gap, gap + 1)).toBe(" ");
        expect(cells[gap - 1].ground).not.toBe("");
        expect(cells[gap].ground).toBe(cells[gap - 1].ground);
      });
    }
  }
});

const STATE = (direction: string): string => `stateDiagram-v2
  direction ${direction}
  A --> B
  note right of A : This is the note`;

describe("a state note's blanks", () => {
  for (const direction of ["TB", "LR"]) {
    for (const borders of BORDER_MODES) {
      for (const theme of ["mono", "dracula"]) {
        it(`wear the note's ground, ${direction}, ${borders}, ${theme}`, () => {
          const row = renderThemedText(STATE(direction), { width: 80, borders }, theme)
            .toAnsi()
            .split("\n")
            .find((line) => line.includes("This")) ?? "";
          const cells = grounds(row);
          const text = cells.map(({ ch }) => ch).join("");
          const from = text.indexOf("This");
          const to = text.indexOf("note", from) + "note".length;
          expect(cells[from].ground).not.toBe("");
          for (let at = from; at < to; at++) expect(cells[at].ground).toBe(cells[from].ground);
        });
      }
    }
  }
});

const BOXED = `sequenceDiagram
  box rgb(91,84,140) Business
  participant A
  end
  box rgb(60,120,110) Tech
  participant B
  end
  A->>B: go
  Note over A,B: Status check
  B->>A: back`;

describe("a sequence note's walls inside a filled box", () => {
  const framed: readonly BorderMode[] = ["default", "padless"];
  for (const borders of framed) {
    for (const theme of ["dracula", "default"]) {
      it(`stand on the note's ground, not the box's, ${borders}, ${theme}`, () => {
        const rows = renderThemedText(BOXED, { width: 80, borders }, theme).toAnsi().split("\n");
        const at = rows.findIndex((line) => line.includes("Status"));
        const note = grounds(rows[at]);
        const inside = note[note.map(({ ch }) => ch).join("").indexOf("Status") - 1].ground;
        // Every non-blank cell of the note's own rows, its walls first, lies on the ground its blanks wear.
        for (const row of borders === "default" ? [at - 1, at, at + 1] : [at]) {
          const cells = grounds(rows[row]);
          const text = cells.map(({ ch }) => ch).join("");
          const from = borders === "default" ? text.search(/[┌│└]/u) : text.lastIndexOf("▏", text.indexOf("Status"));
          const to = borders === "default" ? text.slice(from).search(/[┐│┘]/u) + from : text.indexOf("▕", text.indexOf("Status"));
          expect(cells[from].ground).toBe(inside);
          expect(cells[to].ground).toBe(inside);
        }
      });
    }
  }
});
