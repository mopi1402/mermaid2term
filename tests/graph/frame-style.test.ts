import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";
import { type BorderMode } from "../../src/options.js";
import { stripSgr } from "../support/ansi.js";
import { type PaintedCell, paintedCells } from "../support/grid.js";

const MODES: readonly BorderMode[] = ["default", "padless"];
const FILL = "#553300";
const STROKE = "#ff0000";
const COLOR = "#00ff00";

const rowWith = (ansi: string, word: string): PaintedCell[] =>
  paintedCells(ansi.split("\n").find((line) => stripSgr(line).includes(word)) ?? "");

const at = (row: readonly PaintedCell[], word: string): number => row.map(({ ch }) => ch).join("").indexOf(word);

// The cells either side of a frame's title: its two walls on that row.
const wallsBeside = (drawing: string, title: string): string[] => {
  const row = drawing.split("\n").find((line) => line.includes(title)) ?? "";
  const glyphs = [...row];
  const from = glyphs.indexOf(title[0]);
  return [glyphs.slice(0, from).reverse().find((ch) => ch !== " ") ?? "", glyphs.slice(from + title.length).find((ch) => ch !== " ") ?? ""];
};

const FLOWCHART = (direction: string): string => `flowchart ${direction}
  subgraph outer
    A --> B
    subgraph inner
      C --> D
    end
  end
  classDef hot fill:#553300,stroke:#ff0000,color:#00ff00
  class outer hot
  style inner stroke-dasharray: 5 5`;

const ER = (direction: string): string => `erDiagram
  direction ${direction}
  subgraph outer
    CAR ||--o{ DRIVER : allows
    subgraph inner
      PERSON {
        string name
      }
    end
  end
  style outer fill:#553300,stroke:#ff0000,color:#00ff00
  style inner stroke-dasharray: 5 5`;

const SOURCES: ReadonlyArray<readonly [string, (direction: string) => string, readonly string[]]> = [
  ["flowchart", FLOWCHART, ["TD", "LR"]],
  ["ER", ER, ["TB", "LR"]],
];

describe("a frame's style, as mermaid lays it on the cluster rect", () => {
  for (const [kind, source, directions] of SOURCES) {
    for (const direction of directions) {
      for (const borders of MODES) {
        const named = `${kind}, ${direction}, ${borders}`;

        it(`dashes a nested frame's walls, ${named}`, () => {
          expect(wallsBeside(render(source(direction), { width: 120, borders }), "inner")).toEqual(["╵", "╵"]);
        });

        it(`inks the ring, the title and the air it encloses, ${named}`, () => {
          const title = rowWith(renderThemedText(source(direction), { width: 120, borders }, "dracula").toAnsi(), "outer");
          const from = at(title, "outer");
          expect(title[from].ink).toBe(COLOR);
          expect(title[from].ground).toBe(FILL);
          expect(title[from - 1].ground).toBe(FILL);
          expect(title.find(({ ch }) => ch !== " ")?.ink).toBe(STROKE);
        });

        it(`never shows the theme's ground under its own ring, ${named}`, () => {
          const ansi = renderThemedText(source(direction), { width: 120, borders }, "dracula").toAnsi();
          const ring = ansi.split("\n").flatMap(paintedCells).filter(({ ink }) => ink === STROKE);
          expect(ring.length).toBeGreaterThan(0);
          for (const { ground } of ring) expect(["", FILL]).toContain(ground);
        });

        it(`keeps the theme's ground inside a nested frame that names none, ${named}`, () => {
          const title = rowWith(renderThemedText(source(direction), { width: 120, borders }, "dracula").toAnsi(), "inner");
          const from = at(title, "inner");
          expect(title[from].ground).not.toBe(FILL);
          expect(title[from].ground).not.toBe("");
        });
      }
    }
  }
});

describe("an ER group's title in its own colour", () => {
  for (const direction of ["TB", "LR"]) {
    for (const borders of MODES) {
      it(`still stands on the cluster's ground, ${direction}, ${borders}`, () => {
        const source = `erDiagram
  direction ${direction}
  subgraph outer
    CAR ||--o{ DRIVER : allows
  end
  style outer color:#00ff00`;
        const title = rowWith(renderThemedText(source, { width: 120, borders }, "dracula").toAnsi(), "outer");
        const from = at(title, "outer");
        expect(title[from].ink).toBe(COLOR);
        expect(title[from].ground).toBe(title[from - 1].ground);
        expect(title[from].ground).not.toBe("");
      });
    }
  }
});

describe("classDef default", () => {
  for (const direction of ["TB", "LR"]) {
    for (const borders of MODES) {
      it(`never reaches an ER group, as mermaid starts one with no class, ${direction}, ${borders}`, () => {
        const source = `erDiagram
  direction ${direction}
  subgraph outer
    CAR ||--o{ DRIVER : allows
  end
  classDef default fill:#553300`;
        const title = rowWith(renderThemedText(source, { width: 120, borders }, "dracula").toAnsi(), "outer");
        expect(title[at(title, "outer")].ground).not.toBe(FILL);
      });
    }
  }
});
