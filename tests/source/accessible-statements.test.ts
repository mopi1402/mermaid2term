import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const ACCESSIBLE = "  accTitle: Hidden title\n  accDescr: Hidden line\n  accDescr {\n    Hidden block\n  }\n";
const WIDTHS = [40, 120];
const LEAK_RE = /acc(?:Title|Descr)|Hidden|[{}]/u;

describe("accTitle and accDescr, which mermaid stores off the drawing", () => {
  for (const width of WIDTHS) {
    it(`draws none of them in a journey at ${width} columns`, () => {
      const out = render("journey\n  title Day\n" + ACCESSIBLE + "  section Morning\n    Coffee: 5: Me\n", { width });
      expect(out).toContain("Coffee");
      expect(out).not.toMatch(LEAK_RE);
    });

    for (const direction of ["LR", "TD"]) {
      it(`draws none of them in a timeline ${direction} at ${width} columns`, () => {
        const out = render(`timeline ${direction}\n  title Story\n` + ACCESSIBLE + "  2002 : Started\n", { width });
        expect(out).toContain("Started");
        expect(out).not.toMatch(LEAK_RE);
      });
    }
  }
});

// A blank before the colon, and a block closed on its last line of text, the two spellings the private readers lost.
const LOOSE = "  accTitle : Hidden title\n  accDescr: Hidden line\n  accDescr {\n    Hidden block }\n";
const DIRECTED: ReadonlyArray<readonly [string, (direction: string) => string, readonly string[]]> = [
  ["flowchart", (d) => `flowchart ${d}\n` + LOOSE + "  A --> B\n", ["A", "B"]],
  ["state", (d) => `stateDiagram-v2\n  direction ${d}\n` + LOOSE + "  A --> B\n", ["A", "B"]],
  ["ER", (d) => `erDiagram\n  direction ${d}\n` + LOOSE + "  A ||--o{ B : has\n", ["A", "B", "has"]],
  ["class", (d) => `classDiagram\n  direction ${d}\n` + ACCESSIBLE + LOOSE + "  A <|-- B\n", ["A", "B"]],
];
const UNDIRECTED: ReadonlyArray<readonly [string, string, readonly string[]]> = [
  ["quadrant chart", "quadrantChart\n  accTitle: Hidden\n  accDescr {\n    Hidden: [0.3, 0.6]\n  }\n  Real: [0.5, 0.5]\n", ["Real"]],
  ["architecture", "architecture-beta\n  accTitle: Hidden\n  accDescr {\n    service hid(server)[Hidden]\n  }\n  service api(server)[Api]\n", ["Api"]],
  ["treemap", 'treemap-beta\n  accTitle: Hidden\n  accDescr {\n    "Hidden": 10\n  }\n  "Real": 20\n', ["Real"]],
  ["pie", 'pie\n  accTitle: Hidden\n  accDescr {\n   Hidden }\n  "Real": 1\n  "Also": 2\n', ["Real", "Also"]],
  ["xychart", "xychart-beta\n  x-axis [Real, Also]\n  accTitle: Hidden\n  accDescr {\n   Hidden }\n  bar [1, 2]\n", ["Real", "Also"]],
];

describe("accTitle and accDescr in the kinds that read them with a private copy, or not at all", () => {
  for (const width of WIDTHS) {
    for (const [name, source, kept] of DIRECTED) {
      for (const direction of ["TD", "LR"]) {
        it(`draws none of them in a ${name} ${direction} at ${width} columns, and every statement after them`, () => {
          const out = render(source(direction), { width });
          for (const word of kept) expect(out).toContain(word);
          expect(out).not.toMatch(LEAK_RE);
        });
      }
    }
    for (const [name, source, kept] of UNDIRECTED) {
      it(`draws none of them in a ${name} at ${width} columns`, () => {
        const out = render(source, { width });
        for (const word of kept) expect(out).toContain(word);
        expect(out).not.toMatch(LEAK_RE);
      });
    }
    for (const direction of ["TD", "LR"]) {
      it(`keeps a state whose name only starts with accTitle, ${direction} at ${width} columns`, () => {
        expect(render(`stateDiagram-v2\n  direction ${direction}\n  accTitleFoo --> B\n`, { width })).toContain("accTitleFoo");
      });
    }
  }
});
