import { FRONTMATTER_FENCE } from "./lines.js";
import { QUOTE } from "./quotes.js";
import { NEWLINE } from "../text/chars.js";
import { indentOf } from "../text/format.js";

const ENTRY_RE = /^([^\S\n]*)([A-Za-z][\w-]*)[^\S\n]*:(?:[^\S\n]+(.*?))?[^\S\n]*$/u;
const FLOW_ENTRY_RE = /^\s*(["']?)([A-Za-z][\w-]*)\1\s*:(?:\s+([\s\S]*?))?\s*$/u;
const LITERAL_RE = /^\|([+-]?)$/u;
const BLANK_RE = /\s/u;
const COMMENT = "#";
const SINGLE = "'";
const ESCAPE = "\\";
const ESCAPED_QUOTE_RE = /\\(["'])/gu;
const MAP_OPEN = "{";
const MAP_CLOSE = "}";
const LIST_OPEN = "[";
const LIST_CLOSE = "]";
const COMMA = ",";
const STRIP = "-";
const KEEP = "+";

// Where the quoted run opening `text` closes, a double-quoted one skipping its escapes, a single-quoted one its `''`.
function quoteEnd(text: string, from: number): number {
  const quote = text[from];
  for (let at = from + 1; at < text.length; at++) {
    if (quote === QUOTE && text[at] === ESCAPE) at++;
    else if (text[at] === quote) {
      if (quote === SINGLE && text[at + 1] === SINGLE) at++;
      else return at;
    }
  }
  return -1;
}

const opensQuote = (char: string | undefined): boolean => char === QUOTE || char === SINGLE;

// YAML's quoted scalars: a double-quoted one reads its escapes, a single-quoted one its doubled quote.
function scalar(written: string): string {
  if (written.length >= 2 && written.startsWith(QUOTE) && written.endsWith(QUOTE)) {
    try {
      const read: unknown = JSON.parse(written);
      if (typeof read === "string") return read;
    } catch {
      // not JSON's escapes: the quotes go, and the escaped quotes lose their backslash
    }
    return written.slice(1, -1).replace(ESCAPED_QUOTE_RE, "$1");
  }
  if (written.length >= 2 && written.startsWith(SINGLE) && written.endsWith(SINGLE)) return written.slice(1, -1).replaceAll(SINGLE + SINGLE, SINGLE);
  return written;
}

// A ` #` opens a comment outside quotes, and a `#` glued to a word is text, as YAML reads it.
function uncommented(value: string): string {
  if (opensQuote(value[0])) {
    const end = quoteEnd(value, 0);
    if (end !== -1 && (value.slice(end + 1).trim() === "" || value.slice(end + 1).trimStart().startsWith(COMMENT))) return value.slice(0, end + 1);
    return value;
  }
  for (let at = 0; at < value.length; at++) {
    if (value[at] === COMMENT && (at === 0 || BLANK_RE.test(value[at - 1]))) return value.slice(0, at).trimEnd();
  }
  return value;
}

// The entries of a flow mapping split at its top-level commas, quotes and inner brackets kept whole.
function flowEntries(inside: string): string[] | undefined {
  const entries: string[] = [];
  let depth = 0;
  let from = 0;
  for (let at = 0; at < inside.length; at++) {
    const char = inside[at];
    if (opensQuote(char)) {
      at = quoteEnd(inside, at);
      if (at === -1) return undefined;
    } else if (char === MAP_OPEN || char === LIST_OPEN) depth++;
    else if (char === MAP_CLOSE || char === LIST_CLOSE) depth--;
    else if (char === COMMA && depth === 0) {
      entries.push(inside.slice(from, at));
      from = at + 1;
    }
  }
  entries.push(inside.slice(from));
  return entries.filter((entry) => entry.trim() !== "");
}

// `{theme: dark, themeVariables: {primaryColor: "#fff"}}` on one line; anything it cannot read is undefined.
function flowMap(written: string): Map<string, unknown> | undefined {
  if (!written.startsWith(MAP_OPEN) || !written.endsWith(MAP_CLOSE)) return undefined;
  const entries = flowEntries(written.slice(1, -1));
  if (entries === undefined) return undefined;
  const map = new Map<string, unknown>();
  for (const entry of entries) {
    const found = FLOW_ENTRY_RE.exec(entry) ?? undefined;
    if (found === undefined) return undefined;
    const value = (found[3] ?? "").trim();
    map.set(found[2], valueOf(value));
  }
  return map;
}

const valueOf = (written: string): unknown => (written.startsWith(MAP_OPEN) ? (flowMap(written) ?? written) : scalar(written));

// A `|` block: every deeper line after its key, kept as written less the first one's indent, its end chomped.
function literal(lines: readonly string[], from: number, indent: number, chomp: string): { value: string; next: number } {
  let next = from;
  while (next < lines.length && (lines[next].trim() === "" || indentOf(lines[next]) > indent)) next++;
  const taken = lines.slice(from, next);
  const first = taken.find((line) => line.trim() !== "");
  const inner = first === undefined ? 0 : indentOf(first);
  const body = taken.map((line) => line.slice(Math.min(inner, indentOf(line))));
  const kept = chomp === KEEP ? body : body.slice(0, body.length - [...body].reverse().findIndex((line) => line !== ""));
  const text = body.every((line) => line === "") ? "" : kept.join(NEWLINE);
  return { value: chomp === STRIP || text === "" ? text : text + NEWLINE, next };
}

// A block with its nested blocks kept as dotted keys, `xAxis.showLabel`.
export const dotted = (from: ReadonlyMap<string, unknown>, said: Record<string, string> = {}, prefix = ""): Record<string, string> => {
  for (const [name, value] of from) {
    if (typeof value === "string") said[prefix + name] = value;
    else if (value instanceof Map) dotted(value, said, `${prefix}${name}.`);
  }
  return said;
};

interface Level {
  readonly indent: number;
  readonly node: Map<string, unknown>;
}

// A `---` block is YAML, and what a diagram reads out of it is keys nested by indentation or written as a one-line
// `{...}`, their scalars plain, quoted or a `|` block, a ` #` comment dropped. Nothing else is read (lists, anchors,
// folded scalars), which keeps a whole YAML parser out of a renderer that draws with none of it: a line this cannot
// make sense of is skipped, never guessed at.
export function yamlMap(block: string): Map<string, unknown> {
  const root = new Map<string, unknown>();
  const open: Level[] = [{ indent: -1, node: root }];
  const lines = block.split(NEWLINE);
  for (let at = 0; at < lines.length; at++) {
    const line = lines[at];
    const bare = line.trim();
    if (bare === "" || bare === FRONTMATTER_FENCE || bare.startsWith(COMMENT)) continue;
    const entry = ENTRY_RE.exec(line) ?? undefined;
    if (entry === undefined) continue;
    const indent = entry[1].length;
    while (open.length > 1 && indent <= open[open.length - 1].indent) open.pop();
    const parent = open[open.length - 1].node;
    const value = uncommented(entry[3] ?? "");
    const block = LITERAL_RE.exec(value) ?? undefined;
    if (block !== undefined) {
      const read = literal(lines, at + 1, indent, block[1]);
      parent.set(entry[2], read.value);
      at = read.next - 1;
      continue;
    }
    if (value === "") {
      const child = new Map<string, unknown>();
      parent.set(entry[2], child);
      open.push({ indent, node: child });
      continue;
    }
    parent.set(entry[2], valueOf(value));
  }
  return root;
}
