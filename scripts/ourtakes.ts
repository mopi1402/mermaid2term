import fs from "node:fs";
import path from "node:path";
import { printToConsole, render, renderThemedText } from "../src/index.js";
import { unaskedGround } from "./unasked.js";
import { corpusFiles, DRAWN_DIR, KIND_DIRS, ROOT, SOURCE_EXT, stemOf } from "./corpus.js";

unaskedGround();

const DRAWN_EXT = ".txt";

export const WIDTHS = [40, 80];
export const THEME = "neon";
const CHECK_FLAG = "--check";

// One kind's sources, and the folder its takes stand in.
export interface Corpus {
  readonly name: string;
  readonly sources: string;
  readonly takes: string;
}

export const CORPORA: readonly Corpus[] = KIND_DIRS.map((dir) => ({
  name: path.basename(dir),
  sources: path.join(ROOT, dir),
  takes: path.join(ROOT, dir, DRAWN_DIR),
}));

export const sources = (corpus: Corpus): string[] => corpusFiles(corpus.sources).map(stemOf);

export const sourcePath = (corpus: Corpus, name: string): string =>
  path.join(corpus.sources, `${name}${SOURCE_EXT}`);

export const takePath = (corpus: Corpus, name: string, width: number, theme: string | undefined): string =>
  path.join(corpus.takes, `${name}@${width}${theme === undefined ? "" : `.${theme}`}${DRAWN_EXT}`);

export function drawn(source: string, width: number, theme: string | undefined): string {
  if (theme === undefined) return `${render(source, { width })}\n`;
  return printToConsole(renderThemedText(source, { width }, THEME));
}

function main(): void {
  const check = process.argv.includes(CHECK_FLAG);
  const moved: string[] = [];
  let written = 0;
  let count = 0;

  for (const corpus of CORPORA) {
    if (!check) fs.mkdirSync(corpus.takes, { recursive: true });

    for (const name of sources(corpus)) {
      count++;
      const source = fs.readFileSync(sourcePath(corpus, name), "utf8");
      for (const width of WIDTHS) {
        for (const theme of [undefined, THEME]) {
          const target = takePath(corpus, name, width, theme);
          const take = drawn(source, width, theme);
          if (check) {
            const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
            if (current !== take) moved.push(path.relative(ROOT, target));
            continue;
          }
          fs.writeFileSync(target, take);
          written++;
        }
      }
    }
  }

  if (!check) {
    console.log(`the corpus: ${written} written for ${count} sources`);
    return;
  }
  console.log(moved.length === 0 ? "the corpus: nothing moved" : `the corpus: ${moved.length} moved`);
  for (const name of moved) console.log(`  ${name}`);
  if (moved.length > 0) process.exit(1);
}

if (import.meta.main) main();
