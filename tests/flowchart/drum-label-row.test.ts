// A cylinder's label sits in its body, below the lid, the way the default border draws it: under padless a drum met
// from the side was centred over its whole height, lid included, and the name stuck to the lid.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const FOOT = "⎝";
const NAMES = ["PostgreSQL", "Redis"];

const SOURCES: Record<string, string> = {
  LR: `flowchart LR
    subgraph Server
        C[App Server 1]
        D[App Server 2]
    end
    subgraph Data
        E[(PostgreSQL)]
        F[(Redis)]
    end
    C --> E
    D --> E
    C --> F
    D --> F
`,
  // Down the page, a link reaches a drum's side from a row laid across.
  TD: `flowchart TD
    subgraph S
        direction LR
        C[App Server 1] --> E[(PostgreSQL)]
        D[App Server 2] --> F[(Redis)]
    end
`,
};

function footGap(drawn: string, name: string): number {
  const rows = drawn.split("\n");
  const at = rows.findIndex((row) => row.includes(name));
  const col = [...rows[at]].findIndex((_, i, cells) => cells.slice(i, i + name.length).join("") === name);
  const foot = rows.findIndex((row, r) => r > at && [...row].slice(0, col).includes(FOOT));
  return foot - at;
}

describe("a cylinder's label sits in its body, one row above its foot", () => {
  for (const [direction, source] of Object.entries(SOURCES)) {
    for (const borders of ["default", "padless"] as const) {
      it(`${direction}, ${borders}`, () => {
        const drawn = render(source, { width: 120, borders });
        for (const name of NAMES) expect(footGap(drawn, name), `${name}\n${drawn}`).toBe(1);
      });
    }
  }
});
