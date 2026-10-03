import { isMainThread } from "node:worker_threads";
import { renderThemedText } from "../src/index.js";
import { gridOf } from "../tests/support/grid.js";
import { RULES } from "../tests/invariants/rulebook.js";
import { pooled, serve } from "./pool.js";
import { corpus, type CorpusSource, DRAWN } from "./corpus.js";

// The gate's slice of tests/invariants: every rule of the rulebook on every source, padless on one theme that paints
// true grounds, where the wall and ground bugs live; the three modes and four themes stay in the suite.
const THEME = "dracula";
const WIDTH = 80;

const SOURCES = corpus(DRAWN);

function breachesOf({ at: file, source }: CorpusSource): string[] {
  const grid = gridOf(renderThemedText(source, { width: WIDTH, borders: "padless" }, THEME));
  return Object.entries(RULES).flatMap(([name, rule]) =>
    rule(grid).map((b) => `${name}: ${file} ${b.row}:${b.col} ${b.ch} on ${b.ground || "page"}, wanted ${b.wanted || "page"} [${b.owner}]`)
  );
}

if (!isMainThread) serve((at) => breachesOf(SOURCES[at]));
else {
  const found = (await pooled<string[]>(new URL(import.meta.url), SOURCES.map(({ source }) => source.length))).flat();
  for (const line of found) console.error(line);
  if (found.length > 0) {
    console.error(`\n${found.length} breach(es) of the corpus rules.`);
    process.exit(2);
  }
}
