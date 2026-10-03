import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { getTheme } from "../../src/paint/catalogue.js";
import { type BorderMode } from "../../src/options.js";
import { gridOf } from "../support/grid.js";

// A theme that leaves an edge label's chip bare (`edgeLabelBackground` unset): the label shows what it stands on.
const THEME = "dracula";

// The ground under a word's letters and the padding either side of it.
function groundsAround(source: string, borders: BorderMode, word: string): string[] {
  const grid = gridOf(renderThemedText(source, { width: 120, borders }, THEME));
  const row = grid.find((cells) => cells.map((cell) => cell.ch).join("").includes(word));
  if (row === undefined) throw new Error(`${word} is not drawn`);
  const from = row.map((cell) => cell.ch).join("").indexOf(word);
  return row.slice(from - 1, from + word.length + 1).map((cell) => cell.ground);
}

const FLOWCHART = (direction: string): string => `flowchart ${direction}
    subgraph S [Cluster]
        A -->|pick| B
        B -->|done| A
    end`;

const STATE = (direction: string): string => `stateDiagram-v2
    direction ${direction}
    state Active {
        Ready --> Working : pick
        Working --> Ready : done
    }`;

const hexOf = (colour: string | undefined): string => (colour ?? "").toLowerCase();
const MODES: readonly BorderMode[] = ["default", "padless", "borderless"];

describe("a bare edge label inside a frame stands on the frame's ground, padding and all", () => {
  const cases: ReadonlyArray<readonly [string, (direction: string) => string, string, string]> = [
    ["a flowchart subgraph", FLOWCHART, "TD", hexOf(getTheme(THEME).variables.clusterBkg)],
    ["a flowchart subgraph", FLOWCHART, "LR", hexOf(getTheme(THEME).variables.clusterBkg)],
    ["a composite state", STATE, "TB", hexOf(getTheme(THEME).variables.compositeBackground)],
    ["a composite state", STATE, "LR", hexOf(getTheme(THEME).variables.compositeBackground)],
  ];
  for (const [what, source, direction, ground] of cases) {
    for (const borders of MODES) {
      it(`in ${what}, ${direction}, ${borders}`, () => {
        expect(groundsAround(source(direction), borders, "pick")).toEqual(Array(6).fill(ground));
      });
    }
  }
});
