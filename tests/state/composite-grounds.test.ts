import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { type BorderMode } from "../../src/options.js";
import { paintedGrid } from "../support/grid.js";

// The ground two cells right of where a word starts its frame's row, under the name and then two rows below it.
function groundsBy(source: string, borders: BorderMode, theme: string, background: string, word: string): readonly [string, string] {
  const rows = paintedGrid(renderThemedText(source, { width: 120, borders, background }, theme).toAnsi());
  const text = rows.map((row) => row.map(({ ch }) => ch).join(""));
  const at = text.findIndex((line) => line.includes(word));
  const from = text[at].indexOf(word);
  const before = [...text[at].slice(0, from)];
  const wall = before.length - 1 - [...before].reverse().findIndex((ch) => ch !== " ");
  return [rows[at][from].ground, rows[at + 2][wall + 2].ground];
}

// Measured on mermaid 12 itself: the name's band, the body, and the body a level down.
const MEASURED: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ["default", "light", "#ececff", "#ffffff", "#f0f0f0"],
  ["dark", "dark", "#1f2020", "#333333", "#555555"],
  ["neutral", "light", "#eeeeee", "#ffffff", "#f4f4f4"],
  ["redux-dark", "dark", "#111113", "#16141f", "#16141f"],
];

const NESTED = (direction: string): string => `stateDiagram-v2
  direction ${direction}
  state Outer {
    state Mid {
      A --> B
    }
  }`;

const MODES: readonly BorderMode[] = ["default", "padless"];

describe("a composite state's body, on mermaid's compositeBackground and altBackground a level down", () => {
  for (const [theme, background, band, body, alt] of MEASURED) {
    for (const direction of ["TB", "LR"]) {
      for (const borders of MODES) {
        const named = `${theme}, ${direction}, ${borders}`;
        it(`lays the band, the body and the nested body as mermaid does, ${named}`, () => {
          expect(groundsBy(NESTED(direction), borders, theme, background, "Outer")).toEqual([band, body]);
          expect(groundsBy(NESTED(direction), borders, theme, background, "Mid")).toEqual([band, alt]);
        });
      }
    }
  }
});

describe("a concurrent region", () => {
  for (const direction of ["TB", "LR"]) {
    for (const borders of MODES) {
      it(`is filled as the name's band, and a composite inside it is a body again, ${direction}, ${borders}`, () => {
        const source = `stateDiagram-v2
  direction ${direction}
  state Outer {
    A --> B
    --
    state Deep {
      E --> F
    }
  }`;
        const rows = paintedGrid(renderThemedText(source, { width: 120, borders, background: "light" }, "default").toAnsi());
        const text = rows.map((row) => row.map(({ ch }) => ch).join(""));
        const at = text.findIndex((line) => line.includes(" A "));
        expect(rows[at][text[at].indexOf(" A ") - 3].ground).toBe("#ececff");
        expect(groundsBy(source, borders, "default", "light", "Deep")).toEqual(["#ececff", "#ffffff"]);
      });
    }
  }
});
