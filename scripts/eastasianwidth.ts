import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { must } from "../src/must.js";
import { NEWLINE } from "../src/text/chars.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TABLE = path.join(ROOT, "src", "tables", "eastasianwidth.ts");
const VERSION_RE = /^\d+\.\d+\.\d+$/u;
const NAMED_VERSION_RE = /Unicode (\d+\.\d+\.\d+)/u;
const FILE_VERSION_RE = /^# EastAsianWidth-(\d+\.\d+\.\d+)\.txt/mu;
const DATA_URL = (version: string): string => `https://www.unicode.org/Public/${version}/ucd/EastAsianWidth.txt`;

const CODE_POINTS = 0x110000;
const WIDE = new Set(["F", "W"]);
const MISSING = "# @missing:";
const COMMENT = "#";
const FIELD = ";";
const RANGE = "..";
const RADIX = 36;
const PAIR = ".";
const NEXT = ",";
const LINE_WIDTH = 118;

interface Rule {
  readonly from: number;
  readonly to: number;
  readonly property: string;
}

const ruleOf = (text: string): Rule | undefined => {
  const [span, property] = text.split(FIELD).map((field) => field.trim());
  if (span === undefined || property === undefined || span === "") return undefined;
  const [from, to] = span.split(RANGE);
  return { from: Number.parseInt(must(from), 16), to: Number.parseInt(to ?? must(from), 16), property };
};

function wideOf(data: string): Uint8Array {
  const wide = new Uint8Array(CODE_POINTS);
  const paint = (rule: Rule | undefined): void => {
    if (rule === undefined) return;
    wide.fill(WIDE.has(rule.property) ? 1 : 0, rule.from, rule.to + 1);
  };
  const lines = data.split(/\r?\n/u);
  for (const line of lines) if (line.startsWith(MISSING)) paint(ruleOf(line.slice(MISSING.length)));
  for (const line of lines) {
    if (line.startsWith(COMMENT) || line.trim() === "") continue;
    const hash = line.indexOf(COMMENT);
    paint(ruleOf(hash === -1 ? line : line.slice(0, hash)));
  }
  return wide;
}

function rangesOf(wide: Uint8Array): Array<readonly [number, number]> {
  const ranges: Array<readonly [number, number]> = [];
  let start: number | undefined;
  for (let cp = 0; cp <= CODE_POINTS; cp++) {
    const on = cp < CODE_POINTS && wide[cp] === 1;
    if (on && start === undefined) start = cp;
    if (!on && start !== undefined) {
      ranges.push([start, cp - 1]);
      start = undefined;
    }
  }
  return ranges;
}

function packed(ranges: ReadonlyArray<readonly [number, number]>): string[] {
  let at = 0;
  const pairs = ranges.map(([from, to]) => {
    const pair = `${(from - at).toString(RADIX)}${PAIR}${(to - from).toString(RADIX)}`;
    at = to;
    return pair;
  });
  const body = pairs.join(NEXT);
  const lines: string[] = [];
  for (let cut = 0; cut < body.length; cut += LINE_WIDTH) lines.push(body.slice(cut, cut + LINE_WIDTH));
  return lines;
}

function table(version: string, ranges: ReadonlyArray<readonly [number, number]>): string {
  const lines = packed(ranges).map((line) => `  "${line}"`);
  return [
    `// TRANSCRIBED from the East Asian Width data of Unicode ${version}. Nothing here is this package's to decide: do not`,
    "// edit by hand, rerun `pnpm eastasianwidth`.",
    "//",
    "// Every code point whose East Asian Width is F or W, the published property with the file's own `@missing` defaults",
    `// honoured. ${ranges.length} ranges, packed as base-36 pairs of (gap from the last range's end, length).`,
    "",
    `const PACKED =${NEWLINE}${lines.join(` +${NEWLINE}`)};`,
    "",
    `const RADIX = ${RADIX};`,
    `const PAIR = "${PAIR}";`,
    `const NEXT = "${NEXT}";`,
    "",
    "const STARTS: number[] = [];",
    "const ENDS: number[] = [];",
    "{",
    "  let at = 0;",
    "  for (const pair of PACKED.split(NEXT)) {",
    "    const [gap, length] = pair.split(PAIR);",
    "    const start = at + Number.parseInt(gap, RADIX);",
    "    const end = start + Number.parseInt(length, RADIX);",
    "    STARTS.push(start);",
    "    ENDS.push(end);",
    "    at = end;",
    "  }",
    "}",
    "",
    "/** Whether this code point is fullwidth or wide. Binary search: the table is sorted and disjoint. */",
    "export function isFullwidthOrWide(cp: number): boolean {",
    "  let low = 0;",
    "  let high = STARTS.length - 1;",
    "  while (low <= high) {",
    "    const mid = (low + high) >> 1;",
    "    if (cp < STARTS[mid]) high = mid - 1;",
    "    else if (cp > ENDS[mid]) low = mid + 1;",
    "    else return true;",
    "  }",
    "  return false;",
    "}",
    "",
  ].join(NEWLINE);
}

async function dataOf(asked: string | undefined): Promise<string> {
  if (asked !== undefined && !VERSION_RE.test(asked)) return fs.readFileSync(asked, "utf8");
  const version = asked ?? must(NAMED_VERSION_RE.exec(fs.readFileSync(TABLE, "utf8"))?.[1], "the table's Unicode version");
  const response = await fetch(DATA_URL(version));
  if (!response.ok) throw new Error(`${DATA_URL(version)} answered ${response.status}`);
  return response.text();
}

async function main(): Promise<void> {
  const data = await dataOf(process.argv[2]);
  const version = must(FILE_VERSION_RE.exec(data)?.[1], "the data file's own version line");
  const ranges = rangesOf(wideOf(data));
  fs.writeFileSync(TABLE, table(version, ranges));
  console.log(`${path.relative(ROOT, TABLE)}: ${ranges.length} ranges from Unicode ${version}`);
}

await main();
