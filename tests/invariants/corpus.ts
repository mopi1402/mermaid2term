import { expect, it } from "vitest";
import { declaredType, renderThemedText } from "../../src/index.js";
import { type Text } from "../../src/paint/text.js";
import { type BorderMode } from "../../src/options.js";
import { type Cell, gridOf } from "../support/grid.js";
import { type Breach } from "./rules.js";
import { THREE_PANES } from "../support/drawn.js";
import { corpus, DRAWN } from "../../scripts/corpus.js";

// One theme per way a ground is painted: a home theme's true colours, a mermaid theme turned for the page, reverse
// video, and a gradient look.
const THEMES = ["dracula", "default", "mono", "neo"];
const WIDTH = 80;
// A whole corpus in one theme, a few seconds alone and more under the full suite's load.
const CORPUS_TIMEOUT = 60_000;

const SOURCES: ReadonlyArray<readonly [string, string]> = corpus(DRAWN).map(({ at, source }) => [at, source]);

export type Rule = (grid: readonly Cell[][]) => Breach[];

// Rules held over the whole corpus in one border mode: every source drawn once per theme, every rule read on that one
// drawing, and the breaches listed by rule and by name.
export function holdsOverCorpus(borders: BorderMode, rules: Readonly<Record<string, Rule>>): void {
  for (const theme of THEMES) {
    it(`holds on every source, ${theme}`, () => {
      const breached = SOURCES.flatMap(([file, source]) => breachesOf(file, renderThemedText(source, { width: WIDTH, borders }, theme), rules));
      expect(breached).toEqual([]);
    }, CORPUS_TIMEOUT);
  }
}

function breachesOf(file: string, text: Text, rules: Readonly<Record<string, Rule>>): string[] {
  const grid = gridOf(text);
  return Object.entries(rules).flatMap(([name, rule]) => {
    const found = rule(grid);
    return found.length === 0 ? [] : [`${name} ${file}: ${found.slice(0, 3).map((b) => `${b.row}:${b.col} ${b.ch} ${b.ground || "page"} for ${b.wanted || "page"} [${b.owner}]`).join(", ")}`];
  });
}

const BORDER_MODES: readonly BorderMode[] = ["default", "padless", "borderless"];

// Rules held over every source of one kind, at each width and in each border mode, one width to a test.
export function holdsOverKind(kind: string, rules: Readonly<Record<string, Rule>>): void {
  const sources = SOURCES.filter(([, source]) => declaredType(source)?.startsWith(kind) === true);
  for (const width of THREE_PANES) {
    it(`holds on every ${kind} source at ${width}`, () => {
      expect(sources.length).toBeGreaterThan(0);
      const breached = sources.flatMap(([file, source]) =>
        BORDER_MODES.flatMap((borders) => breachesOf(`${file}@${width} ${borders}`, renderThemedText(source, { width, borders }), rules))
      );
      expect(breached).toEqual([]);
    }, CORPUS_TIMEOUT);
  }
}
