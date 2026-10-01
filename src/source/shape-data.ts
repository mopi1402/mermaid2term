import { stripChars } from "../text/format.js";
import { NEWLINE } from "../text/chars.js";
import { QUOTE, cutAt } from "./quotes.js";

export const BLOCK_OPEN = "@{";
const BLOCK_CLOSE = "}";
const APOSTROPHE = "'";
const QUOTES = QUOTE + APOSTROPHE;
const SEPARATORS = "," + NEWLINE;
// YAML quotes a scalar with `'` only where one starts, so `It's` stays a word.
const SCALAR_START_RE = /(?:^|[:,\s{[])\s*$/u;

// Each character of a block body outside its quoted values, from `from` on.
function* unquoted(text: string, from: number): Generator<number> {
  let quote: string | undefined;
  for (let at = from; at < text.length; at++) {
    const ch = text[at];
    if (quote === APOSTROPHE && ch === APOSTROPHE && text[at + 1] === APOSTROPHE) at++;
    else if (quote !== undefined) {
      if (ch === quote) quote = undefined;
    } else if (ch === QUOTE || (ch === APOSTROPHE && SCALAR_START_RE.test(text.slice(from, at)))) quote = ch;
    else yield at;
  }
}

// Where the `@{` block whose body starts at `from` closes, a `}` inside quotes kept as text; -1 while it runs on.
export function blockEnd(text: string, from: number): number {
  for (const at of unquoted(text, from)) if (text[at] === BLOCK_CLOSE) return at;
  return -1;
}

// A `@{` block runs over line ends in mermaid's `shapeData` state: whether the text leaves one open, a `@{` inside a
// double-quoted label kept as text.
export function opensBlock(text: string): boolean {
  let quoted = false;
  for (let at = 0; at < text.length; at++) {
    if (text[at] === QUOTE) quoted = !quoted;
    else if (!quoted && text.startsWith(BLOCK_OPEN, at)) {
      const end = blockEnd(text, at + BLOCK_OPEN.length);
      if (end === -1) return true;
      at = end;
    }
  }
  return false;
}

// The lines with every block left open joined, over its line ends, to the line that opened it.
export function joinedBlocks(lines: readonly string[], glue: string = NEWLINE): string[] {
  const out: string[] = [];
  for (let at = 0; at < lines.length; at++) {
    let line = lines[at];
    while (opensBlock(line) && at + 1 < lines.length) line += glue + lines[++at].trim();
    out.push(line);
  }
  return out;
}

// The `key: value` pairs of a `@{ ... }` block, one per comma or line, the quotes of either kind off a value: the one
// reader every kind that takes the block shares.
export function parseAtShapeProps(body: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const raw of cutAt(body, unquoted(body, 0), (ch) => SEPARATORS.includes(ch))) {
    const part = raw.trim();
    const at = part.indexOf(":");
    if (at === -1) continue;
    props.set(part.slice(0, at).trim(), stripChars(part.slice(at + 1).trim(), QUOTES, true, true));
  }
  return props;
}
