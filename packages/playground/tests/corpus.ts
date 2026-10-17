import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");
const EXTENSION = ".mmd";

const walk = (directory: string): string[] =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(directory, entry.name))
        : entry.name.endsWith(EXTENSION)
          ? [path.join(directory, entry.name)]
          : []
    );

export const corpus = walk(FIXTURES).map((file) => ({
  file,
  name: path.relative(FIXTURES, file).slice(0, -EXTENSION.length),
  source: fs.readFileSync(file, "utf8"),
}));

const BOX = /<span class="cell" style="--w:(\d+)[^"]*">[\s\S]*?<\/span>/g;
export const TAG = /<\/?(?:span|a|div)[^>]*>/g;
const UNESCAPES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  // Last, or an `&amp;lt;` escaped once would come out as `<`.
  [/&amp;/g, "&"],
];

/** Columns this HTML line occupies: what the boxes announce, one per code point for the rest. */
export const htmlColumns = (html: string): number => {
  let total = 0;
  const rest = html.replace(BOX, (_whole, width: string) => {
    total += Number(width);
    return "";
  });
  const text = UNESCAPES.reduce((out, [from, to]) => out.replace(from, to), rest.replace(TAG, ""));
  return total + [...text].length;
};
