import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { watchTextClashes, type TextClash } from "../../src/canvas/canvas.js";
import { THREE_PANES, TWO_PANES } from "../support/drawn.js";

// Measured on mermaid 12.0.0 headless, 2026-09-29: an edge label is an html label in every kind, each `<br>` starting a
// row of it, the blanks around the tag dropped.
const heard: TextClash[] = [];
beforeAll(() => watchTextClashes((clash) => heard.push(clash)));
afterAll(() => watchTextClashes(undefined));

const rowsOf = (source: string, width: number, padless: boolean): string[] => {
  heard.length = 0;
  const rows = render(source, padless ? { width, borders: "padless" } : { width }).split("\n");
  expect(heard).toEqual([]);
  return rows;
};

const WORD = (word: string): RegExp => new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, "u");

const HEADS = /[⏵⏴⏶⏷▷◁△▽◆◇●]/gu;
const headsOf = (text: string): number => text.match(HEADS)?.length ?? 0;

// Each pair stands on two rows, the second right under the first and their centres at most a cell apart, and the
// drawing keeps every head and marker the one-row reading of the same source draws.
// A class wall meeting its rule and an ER exactly-one both draw a ┼ of their own; anywhere else it would be a crossing.
function expectBroken(source: string, width: number, padless: boolean, pairs: ReadonlyArray<readonly [string, string]>, crossFree = true): void {
  const rows = rowsOf(source, width, padless);
  const text = rows.join("\n");
  expect(headsOf(text), text).toBe(headsOf(rowsOf(source.replace(/<br\s*\/?>/gu, " "), width, padless).join("\n")));
  expect(text).not.toContain("br>");
  if (crossFree) expect(text).not.toContain("┼");
  for (const [upper, lower] of pairs) {
    const top = rows.findIndex((row) => WORD(upper).test(row));
    expect(top, `${upper} in\n${text}`).toBeGreaterThanOrEqual(0);
    expect(WORD(lower).test(rows[top + 1] ?? ""), `${lower} under ${upper} in\n${text}`).toBe(true);
    const centre = (row: string, word: string): number => (WORD(word).exec(row)?.index ?? -99) + word.length / 2;
    expect(Math.abs(centre(rows[top], upper) - centre(rows[top + 1], lower)), text).toBeLessThanOrEqual(1);
    expect(text).not.toContain(`${upper} ${lower}`);
  }
}

const directed = (header: string, body: string, statement: boolean): Array<[string, string]> => [
  ["TD", statement ? `${header}\n${body}` : `${header} TD\n${body}`],
  ["LR", statement ? `${header}\ndirection LR\n${body}` : `${header} LR\n${body}`],
];

const CASES: Array<[string, string, string, ReadonlyArray<readonly [string, string]>]> = [
  ...directed("flowchart", "A -->|go<br>now| B\nA -- \"one<br/>two<br />three\" --> C\nB --> D\nC -->|back<br>home| A", false).map(
    ([dir, source]): [string, string, string, ReadonlyArray<readonly [string, string]>] => ["flowchart", dir, source, [["go", "now"], ["one", "two"], ["two", "three"], ["back", "home"]]]
  ),
  ...directed("flowchart", "subgraph S\n  A -->|go<br>now| B\nend\nB -->|leave<br>frame| C", false).map(
    ([dir, source]): [string, string, string, ReadonlyArray<readonly [string, string]>] => ["flowchart framed", dir, source, [["go", "now"], ["leave", "frame"]]]
  ),
  ...directed("classDiagram", "A --> E : label<br>broken\nA <|-- B : is<br>kind", true).map(
    ([dir, source]): [string, string, string, ReadonlyArray<readonly [string, string]>] => ["class", dir, source, [["label", "broken"], ["is", "kind"]]]
  ),
  ...directed("erDiagram", 'A ||--o{ B : "has<br>many"\nB }|--|| C : "one<br>two<br>three"', true).map(
    ([dir, source]): [string, string, string, ReadonlyArray<readonly [string, string]>] => ["ER", dir, source, [["has", "many"], ["one", "two"], ["two", "three"]]]
  ),
  ...directed("stateDiagram-v2", "[*] --> A\nA --> B : go<br>now\nB --> A : come<br>back", true).map(
    ([dir, source]): [string, string, string, ReadonlyArray<readonly [string, string]>] => ["state", dir, source, [["go", "now"], ["come", "back"]]]
  ),
];

const UNDIRECTED: Array<[string, string, ReadonlyArray<readonly [string, string]>]> = [
  ["architecture", "architecture-beta\ngroup g(cloud)[G]\nservice a(server)[A] in g\nservice b(server)[B]\nservice c(disk)[C] in g\na:R -[go<br>now]- L:b\na:B -[down<br>here]- T:c", [["go", "now"], ["down", "here"]]],
  ["block", 'block-beta\ncolumns 2\na b c d\na -- "go<br>now" --> b\na -- "down<br>there" --> c', [["go", "now"], ["down", "there"]]],
];

describe("a `<br>` in an edge label starts a row of it, as mermaid 12 breaks it", () => {
  for (const padless of [false, true]) {
    const mode = padless ? " padless" : "";
    it.each(CASES)(`%s %s${mode}`, (kind, _dir, source, pairs) => {
      for (const width of THREE_PANES) expectBroken(source, width, padless, pairs, kind !== "class" && kind !== "ER");
    });
    it.each(UNDIRECTED)(`%s${mode}`, (_kind, source, pairs) => {
      for (const width of THREE_PANES) expectBroken(source, width, padless, pairs);
    });
  }
});

describe("a quoted label between the two halves of a link, drawn without its quotes", () => {
  it.each(directed("flowchart", 'A -- "one two" --> C', false))("%s", (_dir, source) => {
    const text = rowsOf(source, 80, false).join("\n");
    expect(text).toContain("one two");
    expect(text).not.toContain('"');
  });
});

describe("a class's self relation under padless stands its marks on the wall, as every other relation does", () => {
  it.each(directed("classDiagram", "S --> S : self<br>loop\nS <|-- S", true))("%s", (_dir, source) => {
    for (const width of TWO_PANES) {
      const text = rowsOf(source, width, true).join("\n");
      expect(text, text).not.toMatch(/▏[⏴◁▷⏵]/u);
      expect(text, text).toMatch(/▕[⏴◁▷⏵]/u);
    }
  });
});

describe("an ER self relation flanked on one side loops out of the other, the page moved right for it", () => {
  const LOOPED: Array<[string, string]> = [
    ["LR", 'erDiagram\ndirection LR\nC ||--|| B : "one two three"\nB }o--|| A : "has many"\nC ||--o{ A : "side way"\nC ||--|| C : "self ref"'],
    ["RL", 'erDiagram\ndirection RL\nA ||--o{ B : "has many"\nB }|--|| C : "one two three"\nA ||--o{ C : "side way"\nC ||--|| C : "self ref"'],
  ];
  it.each(LOOPED)("%s", (_dir, source) => {
    for (const width of TWO_PANES) {
      const text = rowsOf(source, width, false).join("\n");
      expect(text).toContain("one two three");
      expect(text).toContain("╰─ self ref ──╯");
    }
  });
});
