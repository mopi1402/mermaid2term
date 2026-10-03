import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, reaches, sources } from "../support/sources.js";

const SRC = join(ROOT, "src");

const ORDER = [
  ["tables", "must.ts"],
  ["text", "colour"],
  ["source"],
  ["canvas", "options.ts"],
  ["paint"],
  ["graph"],
  ["diagrams"],
  ["index.ts", "api.ts", "fit.ts"],
  ["cli"],
];
const RANK = new Map(ORDER.flatMap((level, at) => level.map((name) => [name, at] as const)));

const zoneOf = (file: string): string => {
  const parts = relative(SRC, file).split(sep);
  return parts.length > 1 ? parts[0] : parts[parts.length - 1];
};

describe("the zones of `src/` are a stack, and a file reads only what stands below it", () => {
  it("places every folder and root file of `src/` in the order, so a new one is placed on purpose", () => {
    const unplaced = [...new Set(sources(SRC).map(zoneOf))].filter((zone) => !RANK.has(zone));
    expect(unplaced.sort()).toEqual([]);
  });

  it("finds no VALUE read from a zone above", () => {
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      const here = RANK.get(zoneOf(file));
      if (here === undefined) continue;
      for (const reach of reaches(readFileSync(file, "utf8"), file)) {
        if (!reach.module.startsWith(".")) continue;
        const target = `${resolve(dirname(file), reach.module.replace(/\.js$/u, ""))}.ts`;
        const there = RANK.get(zoneOf(target));
        if (there === undefined || there <= here || reach.typesOnly) continue;
        offenders.push(`${relative(SRC, file)} -> ${relative(SRC, target)}`);
      }
    }
    expect(offenders.sort()).toEqual([]);
  });
});
