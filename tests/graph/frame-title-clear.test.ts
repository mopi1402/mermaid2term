import { describe, expect, it } from "vitest";

import { render, renderThemedText } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";
import { gridOf } from "../support/grid.js";
import { titleOverLineBreaches } from "../invariants/rules.js";
import { THREE_PANES } from "../support/drawn.js";

const BORDERS = ["default", "padless"] as const;

const NAMESPACES = (dir: string): string => `classDiagram
  direction ${dir}
  namespace Company.Engineering.Backend {
    class Developer
  }
  namespace Company.Engineering.Frontend {
    class Designer
  }
  namespace Company.Engineering {
    class TechLead
  }
  TechLead --> Developer : leads
  TechLead --> Designer : leads`;

const LONG_NAME = (dir: string): string => `flowchart ${dir}
  A[entry] --> B
  subgraph S [two columns for the canvas]
    B[parse] --> C[render]
  end
  C --> D[exit]`;

const WIDE_NAME = (dir: string): string => `flowchart ${dir}
  A[entry] --> B
  subgraph S [plusieurs points de code un seul grapheme]
    B[parse] --> C[render]
  end
  C --> D[exit]`;
const WIDE_WORDS = ["plusieurs", "points", "de", "code", "un", "seul", "grapheme"];

const SHORT_NAME = (dir: string): string => `flowchart ${dir}
  A[entree] --> B
  subgraph moteur
    B[parse] --> C[rendu]
  end`;

const covered = (source: string, width: number, borders: (typeof BORDERS)[number]): number =>
  titleOverLineBreaches(gridOf(renderThemedText(source, { width, borders }))).length;

describe("a frame's title never covers a line running through its row", () => {
  for (const dir of ["TD", "LR", "BT"]) {
    for (const width of THREE_PANES) {
      for (const borders of BORDERS) {
        it(`a namespace's name steps beside the relation (${dir}, ${width}, ${borders})`, () => {
          expect(covered(NAMESPACES(dir), width, borders)).toBe(0);
        });
        it(`a subgraph too narrow for its name beside the stems widens (${dir}, ${width}, ${borders})`, () => {
          expect(covered(LONG_NAME(dir), width, borders)).toBe(0);
        });
      }
    }
  }

  it.each(["TD", "LR"])("keeps a blank between a subgraph's name and the stem beside it (%s)", (dir) => {
    for (const borders of BORDERS) {
      const row = render(SHORT_NAME(dir), { width: 40, borders }).split("\n").find((line) => line.includes("moteur"));
      expect(row).toMatch(/\smoteur\s/u);
    }
  });

  it.each(["TD", "LR"])("keeps a blank between a namespace's name and the stem beside it (%s)", (dir) => {
    for (const borders of BORDERS) {
      const rows = render(NAMESPACES(dir), { width: 40, borders }).split("\n");
      for (const name of ["Backend", "Frontend"]) expect(rows.find((line) => line.includes(name))).toMatch(new RegExp(`\\s${name}\\s`, "u"));
    }
  });

  it.each(["TD", "LR", "BT"])("folds a subgraph's name on words rather than widen its frame past the budget (%s)", (dir) => {
    for (const borders of BORDERS) {
      const out = render(WIDE_NAME(dir), { width: 40, borders });
      const rows = out.split("\n");
      expect(Math.max(...rows.map(displayWidth))).toBeLessThanOrEqual(40);
      expect(covered(WIDE_NAME(dir), 40, borders)).toBe(0);
      const named = rows.filter((line) => /plusieurs|grapheme/u.test(line));
      expect(named.length).toBeGreaterThanOrEqual(2);
      for (const word of WIDE_WORDS) expect(out).toMatch(new RegExp(`\\s${word}\\s`, "u"));
    }
  });

  it.each(["TD", "LR", "BT"])("keeps a subgraph's name whole on one row while the budget holds it (%s)", (dir) => {
    for (const borders of BORDERS) {
      expect(render(WIDE_NAME(dir), { width: 120, borders })).toContain("plusieurs points de code un seul grapheme");
    }
  });
});
