// A double-quoted run is TEXT: nothing inside it is a delimiter, an arrow, a shape or a separator.
export const QUOTE = '"';
// What a double quote is swapped for where a label is written back into a quoted source.
export const SAFE_QUOTE = "'";

// mermaid's `NSTR2` and `NSTR` states: the fence of a markdown string, then plain quotes, come off the text.
const FENCED_RE = /^"`([\s\S]*)`"$/u;
const PLAIN_QUOTED_RE = /^"([^"]*)"$/u;
export const unfenced = (text: string): string => FENCED_RE.exec(text)?.[1] ?? PLAIN_QUOTED_RE.exec(text)?.[1] ?? text;

const OPENERS = "[({";
const CLOSERS = "])}";

// Each index outside quotes (any of `quotes`) and, with `brackets`, outside brackets; a quote itself is never yielded.
export function* outsideQuotesAndBrackets(line: string, brackets = true, quotes = QUOTE): Generator<number> {
  let quoted: string | undefined;
  let depth = 0;
  for (let at = 0; at < line.length; at++) {
    const char = line[at];
    if (quoted !== undefined) {
      if (char === quoted) quoted = undefined;
    } else if (quotes.includes(char)) quoted = char;
    else if (brackets && OPENERS.includes(char)) depth++;
    else if (brackets && CLOSERS.includes(char)) depth = Math.max(0, depth - 1);
    else if (depth === 0) yield at;
  }
}

// `text` cut at each one-character `separator` outside quotes and, with `brackets`, outside brackets.
export const splitOutside = (text: string, separator: string, brackets: boolean): string[] =>
  cutAt(text, outsideQuotesAndBrackets(text, brackets), (ch) => ch === separator);

// `text` cut at each of `indices` whose character `cuts`, the cutting character dropped.
export function cutAt(text: string, indices: Iterable<number>, cuts: (ch: string) => boolean): string[] {
  const parts: string[] = [];
  let from = 0;
  for (const at of indices) {
    if (!cuts(text[at])) continue;
    parts.push(text.slice(from, at));
    from = at + 1;
  }
  parts.push(text.slice(from));
  return parts;
}

export const splitOutsideQuotes = (text: string, separator: string): string[] => splitOutside(text, separator, false);

export function insideQuotes(text: string, pos: number): boolean {
  let inQuote = false;
  for (let i = 0; i < pos; i++) if (text[i] === QUOTE) inQuote = !inQuote;
  return inQuote;
}

// A run between backticks is one word to mermaid's class and ER lexers, spaces and all.
export const BACKTICKED = String.raw`\x60[^\x60]+\x60`;

export const unBackticked = (word: string): string => (word.length >= 2 && word.startsWith("`") && word.endsWith("`") ? word.slice(1, -1) : word);

export const stripQuotes = (text: string): string =>
  text.length >= 2 && text.startsWith(QUOTE) && text.endsWith(QUOTE) ? text.slice(1, -1) : text;

// `text` with every code unit inside quotes blanked, so each index still points where it did.
export function maskQuotes(text: string, brackets = false): string {
  const outside = new Set(outsideQuotesAndBrackets(text, brackets));
  let out = "";
  for (let at = 0; at < text.length; at++) out += outside.has(at) || text[at] === QUOTE ? text[at] : " ";
  return out;
}
