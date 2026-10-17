import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOUNDARY, ROOT, assertedAt, sources } from "../support/sources.js";

// `as` is refused, unless the line reads what the platform hands back and says so with `// boundary:`. What a cast

const TREES = [
  "src",
  "scripts",
  "tests",
  "packages/playground/src",
  "packages/playground/tests",
  "vitest.config.ts",
  join("packages", "playground", "vite.config.ts"),
];
const SPELLERS = new Set(["tests/code/assertions.test.ts", "tests/support/sources.ts"]);

describe("no type assertion but at a marked boundary: the compiler is shown, never told", () => {
  for (const dir of TREES) {
    it(`finds no \`as T\` in ${dir} off a \`// boundary:\` line`, () => {
      const offenders: string[] = [];
      for (const file of sources(join(ROOT, dir))) {
        const path = file.slice(ROOT.length + 1);
        if (SPELLERS.has(path)) continue;
        const raw = readFileSync(file, "utf8").split("\n");
        for (const at of assertedAt(raw.join("\n"), file)) {
          if (!BOUNDARY.test(raw[at] ?? "")) offenders.push(`${path}:${at + 1}: ${(raw[at] ?? "").trim()}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});
