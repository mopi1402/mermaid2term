import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { stripSgr } from "../support/ansi.js";

const OVERRIDES = /[‪-‮⁦-⁩]/u;
const RLO = "‮";
const PDF = "‬";
const LRI = "⁦";
const ZWJ_FAMILY = "\u{1f468}‍\u{1f469}‍\u{1f467}";

const source = (direction: string): string =>
  `flowchart ${direction}\n  A["pay ${RLO}LIVE.exe${PDF} ok"] --> B["#8238;unterminated"] --> C["${LRI}isolated"] --> D["${ZWJ_FAMILY}"]\n`;

// An unterminated override would turn the rest of the row around, other nodes and edges included.
describe("a bidi embedding, override or isolate never reaches the terminal", () => {
  for (const direction of ["TD", "LR"]) {
    it(`${direction}: plain and themed`, () => {
      const plain = render(source(direction), { width: 100 });
      expect(plain).not.toMatch(OVERRIDES);
      expect(plain).toContain("LIVE.exe");
      expect(plain).toContain(ZWJ_FAMILY);
      expect(stripSgr(renderThemed(source(direction), { width: 100 }, "default"))).not.toMatch(OVERRIDES);
    });
  }
});
