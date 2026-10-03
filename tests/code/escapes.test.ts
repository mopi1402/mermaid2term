import { describe, expect, it } from "vitest";
import { offenders, uncommented, type Guard } from "../support/sources.js";

const CONTROL = /\\x1b|\\u001b|\\u\{0*1b\}|\\033|\\x07|\\u0007|\\u\{0*7\}|\\x00(?!-)|\\u0000|\\u\{0*0\}|[\x00\x07\x1b]/iu;
const CHARACTER = /(?<!\\)(["'`])\\[nt]\1/u;
const BLANK = /\b(?:const|let|var) [A-Za-z_0-9]+ = (["'`]) \1;/u;
const SPELLERS = new Set(["src/paint/escapes.ts", "src/text/chars.ts", "tests/code/escapes.test.ts"]);

const guard = (refuses: (line: string) => boolean): Guard => ({ reads: uncommented, spellers: SPELLERS, refuses });

describe("every control byte and named character is written in one file and imported everywhere else", () => {
  for (const dir of ["src", "scripts"]) {
    it(`finds no ESC, BEL or NUL in ${dir} outside the one file that spells them`, () => {
      expect(offenders(dir, guard((line) => CONTROL.test(line)))).toEqual([]);
    });
  }

  for (const dir of ["src", "scripts"]) {
    it(`finds no "\\n", "\\t" or re-declared blank in ${dir} outside the file that spells them`, () => {
      expect(offenders(dir, guard((line) => CHARACTER.test(line) || BLANK.test(line)))).toEqual([]);
    });
  }
});
