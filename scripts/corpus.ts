import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SOURCE_EXT = ".mmd";
export const FIXTURES = "fixtures";
// A source kept for the drawn invariants alone: a known defect still pending, never frozen as a take.
const STRESS_EXT = ".stress.mmd";
// Where a kind's takes stand, beside its sources.
export const DRAWN_DIR = "drawn";

// One folder per diagram kind, named as its checklist under docs/.
export const KIND_DIRS: readonly string[] = readdirSync(path.resolve(ROOT, FIXTURES), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(FIXTURES, entry.name))
  .sort();

// Every source drawn and frozen, and every source at all, stress cases included.
export type Reach = "drawn" | "every";
export const DRAWN: Reach = "drawn";
export const EVERY: Reach = "every";

// One source: its kind's folder, its file, the two joined, the file's name without extension, and that name under its
// kind (`flowchart/basic`), unique where the name alone is not.
export interface CorpusSource {
  readonly dir: string;
  readonly file: string;
  readonly at: string;
  readonly name: string;
  readonly id: string;
  readonly source: string;
}

const stressed = (file: string): boolean => file.endsWith(STRESS_EXT);

// The sources of one folder, by file name, a relative folder read from the repository's root.
export const corpusFiles = (dir: string, reach: Reach = DRAWN): string[] =>
  readdirSync(path.resolve(ROOT, dir))
    .filter((file) => file.endsWith(SOURCE_EXT) && (reach === EVERY || !stressed(file)))
    .sort();

export const stemOf = (file: string): string => file.slice(0, -(stressed(file) ? STRESS_EXT : SOURCE_EXT).length);

export const corpus = (reach: Reach): CorpusSource[] =>
  KIND_DIRS.flatMap((dir) =>
    corpusFiles(dir, reach).map((file) => ({
      dir,
      file,
      at: path.join(dir, file),
      name: stemOf(file),
      id: `${path.basename(dir)}/${stemOf(file)}`,
      source: readFileSync(path.resolve(ROOT, dir, file), "utf8"),
    }))
  );
