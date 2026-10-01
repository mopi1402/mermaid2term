import { indentOf, splitLines } from "../text/format.js";
import { NEWLINE } from "../text/chars.js";
import { QUOTE, outsideQuotesAndBrackets, splitOutside } from "./quotes.js";

export const COMMENT = "%%";
export const DIRECTIVE = "%%{";
export const TITLE_WORD = "title";
export const TITLE = `${TITLE_WORD} `;
export const SECTION_WORD = "section";
// The opening fence, the YAML inside, the closing fence: one regex for every reader and writer of the block.
export const FRONTMATTER_RE = /^(---[^\S\n]*\n)([\s\S]*?)(\n---[^\S\n]*\n)/u;
export const FRONTMATTER_FENCE = "---";
export const SEMICOLON = ";";

function cutComment(line: string, brackets: boolean, quotes = QUOTE): string {
  for (const at of outsideQuotesAndBrackets(line, brackets, quotes)) if (line.startsWith(COMMENT, at)) return line.slice(0, at);
  return line;
}

// `%%` opens a comment outside quotes and brackets only: inside them it is text, as in mermaid's string and shape states.
export const uncommented = (line: string): string => cutComment(line, true);

// The same cut for a grammar whose strings open on any of `quotes`.
const uncommentedIn = (line: string, quotes: string): string => cutComment(line, true, quotes);

// `%%` opens a comment anywhere outside quotes, for a lexer whose braces are no text state (ER's `o{` is an end).
export const uncommentedPastBrackets = (line: string): string => cutComment(line, false);

// A `;` ends a statement outside quotes and brackets alone: `A[a &lt; b]` is one node, as mermaid 12 reads it.
export const statementsOf = (line: string): string[] => splitOutside(line, SEMICOLON, true);

// A header line's keyword match, the words after the keyword (a direction, a flag) in its groups, and what the line
// holds past them, which mermaid's lexer reads as the first statement (`erDiagram A ||--|| B : x`); undefined for a
// line that is not the header. The pattern is anchored at the trimmed line's start.
export function headerOf(line: string, keyword: RegExp): { readonly words: RegExpExecArray; readonly tail: string } | undefined {
  const trimmed = line.trim();
  const words = keyword.exec(trimmed) ?? undefined;
  return words === undefined ? undefined : { words, tail: trimmed.slice(words[0].length).trim() };
}

export const headerTail = (line: string, keyword: RegExp): string | undefined => headerOf(line, keyword)?.tail;

// The statements under a header, what its own line holds past the keyword first; a first line that is no header
// holds none.
export function headerBody(lines: readonly string[], keyword: RegExp): string[] {
  const tail = lines.length === 0 ? "" : (headerTail(lines[0], keyword) ?? "");
  return tail === "" ? lines.slice(1) : [tail, ...lines.slice(1)];
}

export function keptLines(text: string, quotes = QUOTE): string[] {
  const kept: string[] = [];
  for (const line of splitLines(text)) {
    const bare = uncommentedIn(line, quotes).trimEnd();
    if (bare.trim() !== "") kept.push(bare);
  }
  return kept;
}

export const contentLines = (text: string, quotes = QUOTE): string[] => keptLines(text, quotes).map((line) => line.trim());

export { words } from "../text/format.js";

export function firstWords(line: string, count: number): string[] {
  const out: string[] = [];
  let rest = line.trimStart();
  while (out.length < count && rest !== "") {
    const at = rest.search(/\s/);
    if (at === -1) break;
    out.push(rest.slice(0, at));
    rest = rest.slice(at).trimStart();
  }
  if (rest !== "") out.push(rest);
  return out;
}

// Each line with its indent, a statement still open at its end running on over the next lines, as a mindmap-family
// lexer carries a string or a `@{` block over line ends.
export function indentedStatements(lines: readonly string[], opens: (text: string) => boolean): Array<readonly [number, string]> {
  const out: Array<readonly [number, string]> = [];
  for (let at = 0; at < lines.length; at++) {
    const line = lines[at];
    let text = line.trim();
    while (opens(text) && at + 1 < lines.length) text += NEWLINE + lines[++at].trim();
    out.push([indentOf(line), text]);
  }
  return out;
}

// A mindmap-family lexer reads the keyword, then the blanks after it as the first statement's indent.
export function headerStatement(header: string, keyword: string): Array<readonly [number, string]> {
  const rest = header.trimStart().slice(keyword.length);
  return rest.trim() === "" ? [] : [[indentOf(rest), rest.trim()]];
}

const BLANK_RE = /\s/u;

// The rest of `line` after `keyword` and the one character mermaid's `keyword\s` rules take (a kind's own `stop`
// where its lexer takes less), any case.
export function keywordRest(line: string, keyword: string, stop: RegExp = BLANK_RE): string | undefined {
  if (line.length <= keyword.length + 1) return undefined;
  if (line.slice(0, keyword.length).toLowerCase() !== keyword) return undefined;
  return stop.test(line[keyword.length]) ? line.slice(keyword.length + 1) : undefined;
}
