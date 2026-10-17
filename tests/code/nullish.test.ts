import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOUNDARY, codeOf, offenders, type Guard } from "../support/sources.js";

const NULLISH = /\bnull\b|toBeNull/u;
const SPELLERS = new Set(["tests/code/nullish.test.ts"]);
const TREES = [
  "src",
  "scripts",
  "tests",
  "packages/playground/src",
  "packages/playground/tests",
  "vitest.config.ts",
  join("packages", "playground", "vite.config.ts"),
];

describe("`undefined` is the one nullish value: `null` is written nowhere in the code but at a marked boundary", () => {
  for (const dir of TREES) {
    it(`finds no \`null\` in ${dir}, in a type, a value, a comparison or a return`, () => {
      const guard: Guard = {
        reads: codeOf,
        spellers: SPELLERS,
        refuses: (line: string, raw: string) => NULLISH.test(line) && !BOUNDARY.test(raw),
      };
      expect(offenders(dir, guard)).toEqual([]);
    });
  }
});
