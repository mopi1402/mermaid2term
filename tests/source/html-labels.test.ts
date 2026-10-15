import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

// Measured on mermaid 12.0.0 headless, 2026-09-29: its html labels break a box's text on `<br>` and resolve every
// HTML character reference; a label along a line breaks too, frozen by tests/graph/edge-label-rows.test.ts.
const rowsOf = (source: string, width = 80): string[] => render(source, { width }).split("\n");
const rowOf = (rows: readonly string[], text: string): number => rows.findIndex((row) => row.includes(text));
const drawn = (source: string, width = 80): string => rowsOf(source, width).join("\n");

const expectStacked = (rows: readonly string[], upper: string, lower: string): void => {
  const top = rowOf(rows, upper);
  expect(top).toBeGreaterThanOrEqual(0);
  expect(rowOf(rows, lower)).toBe(top + 1);
};

const directed = (header: string, body: string): Array<[string, string]> => [
  [`${header} TD`, `${header}\n${body}`],
  [`${header} LR`, `${header}\ndirection LR\n${body}`],
];

describe("HTML character references, resolved as mermaid 12's html labels resolve them", () => {
  it.each(directed("classDiagram", "class A {\n  +p &amp; q\n  +m(a&lt;b&gt;) int\n}\nclass Car[\"Fast &lt;b&gt; &amp; Car\"]\nnote for A \"n &amp; m\""))(
    "a class's label, members and note, %s",
    (_dir, source) => {
      const text = drawn(source);
      expect(text).not.toMatch(/&(?:amp|lt|gt);/u);
      for (const shown of ["+p & q", "+m(a<b>) : int", "Fast <b> & Car", "n & m"]) expect(text).toContain(shown);
    }
  );

  it.each(directed("erDiagram", 'G["a &lt;q&gt; &amp;"]\n"S &amp; T" ||--|| E : "c &lt;d&gt;"\nK {\n  string name "x &amp; y"\n}'))(
    "an entity's name, alias, comment and relationship label, %s",
    (_dir, source) => {
      const text = drawn(source);
      expect(text).not.toMatch(/&(?:amp|lt|gt);/u);
      for (const shown of ["a <q> &", "S & T", "c <d>", "x & y"]) expect(text).toContain(shown);
    }
  );

  it.each(directed("stateDiagram-v2", 'state "d &lt;b&gt; &amp; e" as S\nstate "p &amp; q" as P\nS --> P'))(
    "a state's description, %s",
    (_dir, source) => {
      const text = drawn(source, 120);
      expect(text).not.toMatch(/&(?:amp|lt|gt);/u);
      expect(text).toContain("d <b> & e");
      expect(text).toContain("p & q");
    }
  );

  it.each([80, 120])("an architecture title at %i columns", (width) => {
    const text = drawn("architecture-beta\ngroup g(cloud)[G &lt;x&gt;]\nservice s(server)[S &amp; y] in g\nservice t(disk)[T &lt;b&gt;]", width);
    expect(text).not.toMatch(/&(?:amp|lt|gt);/u);
    for (const shown of ["G <x>", "S & y", "T <b>"]) expect(text).toContain(shown);
  });

  it.each([80, 120])("a block's label at %i columns", (width) => {
    const text = drawn('block-beta\na["x &lt;b&gt; &amp; y"] b', width);
    expect(text).not.toMatch(/&(?:amp|lt|gt);/u);
    expect(text).toContain("x <b> & y");
  });
});

describe("`<br>` in a box's label starts a row, as mermaid 12 breaks it", () => {
  it.each(directed("erDiagram", 'D["al<br>ias"]\n"Q<br/>R" ||--|| E : lbl\nK {\n  string name "com<br>ment"\n}'))(
    "an entity's alias, quoted name and comment, %s",
    (_dir, source) => {
      const rows = rowsOf(source);
      expect(rows.join("\n")).not.toContain("br");
      expectStacked(rows, "al", "ias");
      expectStacked(rows, "Q", "R");
      expectStacked(rows, "com", "ment");
    }
  );

  it.each(directed("stateDiagram-v2", 'state "c<br>d" as C {\n  A --> B\n}'))("a composite state's title, %s", (_dir, source) => {
    const rows = rowsOf(source);
    expect(rows.join("\n")).not.toMatch(/br>|\\n/u);
    expectStacked(rows, "c", "d");
  });

  it.each([80, 120])("an architecture service's and group's title at %i columns", (width) => {
    const rows = rowsOf("architecture-beta\ngroup g(cloud)[Gro<br>up]\nservice s(server)[Ser<br>ver] in g", width);
    expect(rows.join("\n")).not.toContain("br>");
    expectStacked(rows, "Gro", "up");
    expectStacked(rows, "Ser", "ver");
  });
});
