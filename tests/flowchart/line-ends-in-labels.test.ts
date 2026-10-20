import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { stripSgr } from "../support/ansi.js";

const CR = "\r";
const source = (direction: string, end: string): string =>
  `flowchart ${direction}\n  A["Tests: FAILED"] --> B@{ shape: div-rect, label: "a${end}b" } --> C["Tests: PASSED"]\n`;

// mermaid's `cleanupText` reads a CRLF or a lone CR as LF: no CR is left for a terminal to rewind a row with.
describe("a CR in a multi-line label never reaches the drawing", () => {
  for (const direction of ["TD", "LR"]) {
    for (const end of ["\r\n", CR]) {
      it(`${direction}, ${JSON.stringify(end)}`, () => {
        const plain = render(source(direction, end), { width: 80 });
        expect(plain).not.toContain(CR);
        expect(plain).toContain("Tests: FAILED");
        expect(plain).toBe(render(source(direction, "\n"), { width: 80 }));
        expect(stripSgr(renderThemed(source(direction, end), { width: 80 }, "default"))).not.toContain(CR);
      });
    }
  }
});
