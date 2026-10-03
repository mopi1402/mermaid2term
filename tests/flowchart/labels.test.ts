import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

// Measured on mermaid 12.0.0 headless, 2026-09-29: a flowchart's node labels and subgraph titles resolve every HTML
// character reference, a `;` inside brackets is text, a subgraph's bracketed title breaks on `<br>`, a `@{ label }`
// reads as markdown unless its `labelType` is `string` or `text`, and `[|field:value|text]` shows its text alone.
const rowsOf = (source: string, width = 100): string[] => render(source, { width }).split("\n");
const rowOf = (rows: readonly string[], text: string | RegExp): number =>
  rows.findIndex((row) => (typeof text === "string" ? row.includes(text) : text.test(row)));
const drawn = (source: string, width = 100): string => rowsOf(source, width).join("\n");
const bothWays = (body: string): Array<[string, string]> => [
  ["TD", `flowchart TD\n${body}`],
  ["LR", `flowchart LR\n${body}`],
];
const expectStacked = (rows: readonly string[], upper: string | RegExp, lower: string | RegExp): void => {
  const top = rowOf(rows, upper);
  expect(top).toBeGreaterThanOrEqual(0);
  expect(rowOf(rows, lower)).toBe(top + 1);
};

describe("a flowchart node's HTML character references, resolved as mermaid 12 resolves them", () => {
  it.each(bothWays('A["a &lt; b &amp; c"] --> B[a &lt;b&gt; x]\nC(x &amp;y) & D --> E[p;q]\nF[&lt;b&gt;no&lt;/b&gt;]'))(
    "%s",
    (_dir, source) => {
      const text = drawn(source);
      expect(text).not.toMatch(/&(?:amp|lt|gt);|\]/u);
      for (const shown of ["a < b & c", "a <b> x", "x &y", "p;q", "<b>no</b>"]) expect(text).toContain(shown);
      expect(text).toMatch(/│\s+D\s+[│├]/u);
    }
  );
});

describe("a subgraph's title, read as mermaid 12 reads it", () => {
  it.each(bothWays('subgraph s["x<br>y"]\nA\nend\nsubgraph t[plain t]\nB\nend\nsubgraph w[a &amp; b]\nC\nend\nsubgraph v["`**bm** z`"]\nD\nend\nsubgraph "q<br/>r"\nE\nend'))(
    "%s",
    (_dir, source) => {
      const rows = rowsOf(source, 160);
      const text = rows.join("\n");
      expect(text).not.toMatch(/\[|br>|&amp;|`|\*/u);
      expectStacked(rows, /│\s+x\s+│/u, /│\s+y\s+│/u);
      expectStacked(rows, /│\s+q\s+│/u, /│\s+r\s+│/u);
      for (const shown of ["plain t", "a & b", "bm z"]) expect(text).toContain(shown);
    }
  );
});

describe("a `@{ label }` read as markdown, unless its labelType says string or text", () => {
  it.each(bothWays('A@{ label: "**e** _i_" }\nB@{ label: "**d**", labelType: "string" }\nC@{ label: "`f`" }\nD@{ label: "_t_", labelType: "text" }'))(
    "%s",
    (_dir, source) => {
      const text = drawn(source);
      expect(text).toMatch(/│\s+e i\s+│/u);
      for (const shown of ["**d**", "`f`", "_t_"]) expect(text).toContain(shown);
    }
  );
});

describe("a legacy `[|field:value|text]` node shows its text alone", () => {
  it.each(bothWays("A[|field:value|text] --> B"))("%s", (_dir, source) => {
    const text = drawn(source);
    expect(text).not.toContain("|");
    expect(text).toMatch(/│\s+text\s+[│├]/u);
  });
});
