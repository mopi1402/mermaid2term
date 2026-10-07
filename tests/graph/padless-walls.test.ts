// A padless box inks the EDGES of its own cells, so its wall belongs on the column its corners stand on. A head or a
// run that takes that column for itself leaves the outline jogged for one row, which is what this measures, over the
// whole corpus and on the drawing that reported it.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";
import { corpus, DRAWN } from "../../scripts/corpus.js";

// A sweep of the whole corpus, drawn beside the other workers: its own pace, not the default five seconds.
const CORPUS_TIMEOUT = 30_000;

const TOP_LEFT = "◜";
const TOP_RIGHT = "◝";
const BOTTOM_LEFT = "◟";
const LEFT_WALL = "▏";
const RIGHT_WALL = "▕";
const HEAD_LEFT = "⏴";
const HEAD_RIGHT = "⏵";

/** Every row of a closed-up box whose wall inks a column its corners do not stand on. */
const jogs = (drawn: string): Array<[row: number, column: number]> => {
  const rows = drawn.split("\n").map((line) => [...line]);
  const found: Array<[number, number]> = [];
  rows.forEach((cells, row) => {
    cells.forEach((glyph, column) => {
      if (glyph !== TOP_LEFT) return;
      const bottom = rows.findIndex((other, r) => r > row && other[column] === BOTTOM_LEFT);
      if (bottom < 0) return;
      const rightAt = cells.indexOf(TOP_RIGHT, column + 1);
      for (let r = row + 1; r < bottom; r++) {
        if (rows[r][column] !== LEFT_WALL && rows[r][column + 1] === LEFT_WALL) found.push([r, column]);
        if (rightAt > 0 && rows[r][rightAt] !== RIGHT_WALL && rows[r][rightAt - 1] === RIGHT_WALL) found.push([r, rightAt]);
      }
    });
  });
  return found;
};

const sources = corpus(DRAWN);

describe("a padless box keeps its wall on the column its corners stand on", () => {
  it("has a corpus to measure", () => {
    expect(sources.length).toBeGreaterThan(100);
  });

  it("holds over the whole corpus, at every width", () => {
    const guilty: string[] = [];
    for (const { id: file, source } of sources) {
      for (const width of TWO_PANES) {
        const found = jogs(render(source, { width, borders: "padless" }));
        if (found.length > 0) guilty.push(`${file} @${width}: ${found.map(([r, c]) => `${r},${c}`).join(" ")}`);
      }
    }
    expect(guilty).toEqual([]);
  }, CORPUS_TIMEOUT);

  it("inks the outer edge of the end cells of a sequence note, which carries no rule row", () => {
    const drawn = render("sequenceDiagram\n  Alice->>Bob: hi\n  Note right of Bob: Thinking...\n", {
      width: 60,
      borders: "padless",
    });
    // The fill runs behind the walls, so an eighth on the inner edge would leave a sliver of it outside the ink.
    expect(drawn).toContain(`${LEFT_WALL} Thinking... ${RIGHT_WALL}`);
  });

  it("leaves no gap between a head and the wall it points at, over the whole corpus, at every width", () => {
    // A head reaches the ink of the wall beside it or it does not: `▏⏴` and `⏵▕` are the two spellings where the
    // eighth stands on the far edge of its own cell and the head stops a whole cell short of the box.
    const guilty: string[] = [];
    for (const { id: file, source } of sources) {
      for (const width of TWO_PANES) {
        render(source, { width, borders: "padless" })
          .split("\n")
          .forEach((line, row) => {
            const cells = [...line];
            cells.forEach((glyph, column) => {
              if (glyph === HEAD_LEFT && cells[column - 1] === LEFT_WALL) guilty.push(`${file} @${width}: ${row},${column} ${LEFT_WALL}${HEAD_LEFT}`);
              if (glyph === HEAD_RIGHT && cells[column + 1] === RIGHT_WALL) guilty.push(`${file} @${width}: ${row},${column} ${HEAD_RIGHT}${RIGHT_WALL}`);
            });
          });
      }
    }
    expect(guilty).toEqual([]);
  }, CORPUS_TIMEOUT);

  it("gives a SQUARE closed-up box's wall column to the head that lands on it and to the run that leaves it", () => {
    // The wall of a square box inks the INNER edge of its column, so ink and stroke only meet on that column: the
    // head or the run takes it and the wall steps to the neighbouring cell's far edge, the same vertical line.
    const body = "    A[Start] --> B{Decision}\n    B -->|Yes| C[Process]\n    B -->|No| D[End]\n    C --> D";
    const drawn = (direction: string): string[] => render(`flowchart ${direction}\n${body}`, { width: 80, borders: "padless" }).split("\n");
    const rightwards = drawn("RL");
    expect(rightwards[0]).toBe("▕▔▔▔▔▔▔▔▔▔▔▔▏");
    expect(rightwards[1]).toBe("▕  Process ▕⏴──╮");
    expect(rightwards[2].startsWith("▕▁▁▁▁▁▁▁▁▁▁▁▏")).toBe(true);
    const leftwards = drawn("LR");
    expect(leftwards[1]).toBe("                                  ╭──⏵▏ Process  ▏");
    expect(leftwards[7]).toBe("                                  ╰──⏵▏   End    ▏");
    // `C --> D` lies flat in both upright directions, the run leaving one square box for the head of another.
    expect(drawn("TD")[13]).toBe("▕  Process ▕────⏵▏   End    ▏");
    expect(drawn("BT")[1]).toBe("▕  Process ▕────⏵▏   End    ▏");
  });

  it("holds where a head arrives at a closed-up state and a run leaves one", () => {
    const drawn = render(
      "stateDiagram-v2\n  [*] --> Idle\n  Idle --> Processing : submit\n  Processing --> Done : success\n" +
        "  Processing --> Error : failure\n  Error --> Idle : retry\n  Done --> [*]\n",
      { width: 80, borders: "padless" }
    );
    expect(jogs(drawn)).toEqual([]);
    // The head stops in the gap, one cell short of the wall it points at.
    expect(drawn).toMatch(/⏵▏\s+Error\s+▕/u);
  });
});
