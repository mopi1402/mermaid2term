import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { watchTextClashes, type TextClash } from "../../src/canvas/canvas.js";
import { TWO_PANES } from "../support/drawn.js";
import { corpus, EVERY } from "../../scripts/corpus.js";

// A line, a marker or another label drawn over written words once cut `is led by` to `is │ed by`. The canvas now
// refuses such a write and reports it; every source of the corpus, turned every way it can be, must draw without one.
const SOURCES = corpus(EVERY).map(({ at, source }) => ({ name: at, source }));

const LEAD = String.raw`^((?:---[\s\S]*?---\s*)?(?:%%\{[\s\S]*?\}%%\s*)?)`;
const WITH_STATEMENT = new RegExp(`${LEAD}(?:erDiagram|stateDiagram(?:-v2)?|classDiagram(?:-v2)?)[^\\n]*\\n`, "u");
const WITH_HEADER = new RegExp(`${LEAD}(flowchart|graph)(?: +\\w+)?[^\\n]*\\n`, "u");

// The source turned each way its grammar lets a direction be written.
function turned(source: string): Array<[string, string]> {
  const statement = WITH_STATEMENT.exec(source) ?? undefined;
  const header = WITH_HEADER.exec(source) ?? undefined;
  return ["TB", "LR", "RL", "BT"].flatMap((dir): Array<[string, string]> => {
    if (statement !== undefined) return [[dir, source.replace(statement[0], `${statement[0]}    direction ${dir}\n`)]];
    if (header !== undefined) return [[dir, source.replace(header[0], `${header[1]}${header[2]} ${dir}\n`)]];
    return [];
  });
}

// Each source makes two pieces of work, as written and turned, dealt round six test files the workers draw side by side.
const SHARDS = 6;

const heard: TextClash[] = [];
const clashesOf = (source: string, width: number, padless: boolean): string[] => {
  heard.length = 0;
  render(source, padless ? { width, borders: "padless" } : { width });
  return heard.map(({ row, col, text, by }) => `[${row},${col}] ${text} <- ${JSON.stringify(by)}`);
};

function asWritten(source: string): string[] {
  const found: string[] = [];
  for (const width of [30, 40, 80]) {
    for (const padless of [false, true]) {
      found.push(...clashesOf(source, width, padless).map((c) => `@${width}${padless ? " padless" : ""} ${c}`));
    }
  }
  return found;
}

function asTurned(source: string): string[] {
  const found: string[] = [];
  for (const [dir, drawn] of turned(source)) {
    for (const width of TWO_PANES) found.push(...clashesOf(drawn, width, false).map((c) => `${dir}@${width} ${c}`));
  }
  return found;
}

const WORK = SOURCES.flatMap(({ name, source }) => [
  { title: `${name}: every width, padless or default`, check: () => asWritten(source) },
  { title: `${name}: every other direction`, check: () => asTurned(source) },
]);

export function describeShard(shard: number): void {
  describe(`no line, marker or label is ever drawn over written words (${shard + 1}/${SHARDS})`, () => {
    beforeAll(() => watchTextClashes((clash) => heard.push(clash)));
    afterAll(() => watchTextClashes(undefined));
    WORK.forEach(({ title, check }, at) => {
      if (at % SHARDS === shard) it(title, () => expect(check()).toEqual([]), 30_000);
    });
  });
}
