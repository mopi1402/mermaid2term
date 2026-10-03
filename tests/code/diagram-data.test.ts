import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, reaches } from "../support/sources.js";

const DIAGRAMS = join(ROOT, "src", "diagrams");
const HOMES = new Set(["kind.ts", "patterns.ts", "metrics.ts", "ink.ts", "model.ts"]);
const DATA = new Set(["patterns.ts", "metrics.ts", "ink.ts"]);
const CONSTANT = /^[A-Z][A-Z0-9_]*$/u;

const siblingOf = (module: string): string | undefined => {
  const found = /^\.\/([\w.-]+)\.js$/u.exec(module) ?? undefined; // boundary: a regex answers the platform's "no match"
  return found === undefined ? undefined : `${found[1]}.ts`;
};

const folders = readdirSync(DIAGRAMS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const takings = (folder: string): Map<string, Map<string, Set<string>>> => {
  const found = new Map<string, Map<string, Set<string>>>();
  const here = join(DIAGRAMS, folder);
  for (const file of readdirSync(here).filter((name) => name.endsWith(".ts"))) {
    for (const reach of reaches(readFileSync(join(here, file), "utf8"), file)) {
      const from = siblingOf(reach.module);
      if (from === undefined) continue;
      for (const name of reach.names) {
        if (!CONSTANT.test(name)) continue;
        const byName = found.get(from) ?? new Map<string, Set<string>>();
        byName.set(name, (byName.get(name) ?? new Set()).add(file));
        found.set(from, byName);
      }
    }
  }
  return found;
};

describe("a constant several passes read lives in the diagram's own data file", () => {
  for (const folder of folders) {
    it(`finds no shared constant left in a drawing file of ${folder}`, () => {
      const offenders: string[] = [];
      for (const [from, byName] of takings(folder)) {
        if (HOMES.has(from)) continue;
        for (const [name, readers] of byName) {
          if (readers.size > 1) offenders.push(`${folder}/${from}: ${name}, read by ${[...readers].sort().join(", ")}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});

describe("a data file is a LEAF of its folder: it is read, and reads nothing of the drawing", () => {
  for (const folder of folders) {
    it(`finds no drawing imported by a data file of ${folder}`, () => {
      const offenders: string[] = [];
      const here = join(DIAGRAMS, folder);
      for (const file of readdirSync(here).filter((name) => DATA.has(name))) {
        for (const reach of reaches(readFileSync(join(here, file), "utf8"), file)) {
          const from = siblingOf(reach.module);
          if (from !== undefined && !HOMES.has(from)) offenders.push(`${folder}/${file}: ${reach.module}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});
