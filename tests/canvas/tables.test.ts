import { readFileSync } from "node:fs";
import { basename, join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, reaches, sources } from "../support/sources.js";

const TABLES = join(ROOT, "src", "tables") + sep;
const PROVENANCE = /^\/\/ TRANSCRIBED from \S/u;

const named = (file: string): string => basename(file);

describe("a table is TRANSCRIBED, and says so on its first line", () => {
  it("opens every file of `src/tables/` with where it was copied from and how it is redone", () => {
    const offenders = sources(TABLES.slice(0, -1)).filter((file) => !PROVENANCE.test(readFileSync(file, "utf8").split("\n")[0]));
    expect(offenders.map(named)).toEqual([]);
  });

  it("keeps that line for tables alone, so a transcription written elsewhere has nowhere to hide", () => {
    const strays = [...sources(join(ROOT, "src")), ...sources(join(ROOT, "scripts"))]
      .filter((file) => !file.startsWith(TABLES))
      .filter((file) => readFileSync(file, "utf8").split("\n").some((line) => PROVENANCE.test(line)));
    expect(strays.map(named)).toEqual([]);
  });
});

describe("a table knows a TYPE and nothing else, which is what keeps it a leaf", () => {
  it("imports no value, from this package or from anywhere", () => {
    const offenders: string[] = [];
    for (const file of sources(TABLES.slice(0, -1))) {
      for (const reach of reaches(readFileSync(file, "utf8"), file)) {
        if (!reach.typesOnly) offenders.push(`${named(file)}: ${reach.module}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
