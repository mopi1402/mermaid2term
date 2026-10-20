// One piece of a label and the ink it asks for: what reading a rich label produces, and what every box that
// draws one paints from.
import { displayWidth } from "../text/width.js";
import { BR_RE, LITERAL_NEWLINE, labelRowsOf } from "../text/labels.js";
import { htmlDecoded } from "../text/entities.js";
import { NEWLINE, SPACE } from "../text/chars.js";

export interface LabelSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

export interface MarkdownLabel {
  plain: string;
  segments: LabelSegment[];
}

function markdownSegments(md: string): MarkdownLabel {
  const segments: LabelSegment[] = [];
  const plainParts: string[] = [];
  const boundary = (at: number): boolean => at < 0 || at >= md.length || md[at].trim() === "";
  let i = 0;
  while (i < md.length) {
    if (md.slice(i, i + 2) === "**") {
      const end = md.indexOf("**", i + 2);
      if (end !== -1) {
        const inner = md.slice(i + 2, end);
        segments.push({ text: inner, bold: true, italic: false });
        plainParts.push(inner);
        i = end + 2;
        continue;
      }
    }
    if (md[i] === "*") {
      const end = md.indexOf("*", i + 1);
      if (end !== -1) {
        const inner = md.slice(i + 1, end);
        segments.push({ text: inner, bold: false, italic: true });
        plainParts.push(inner);
        i = end + 1;
        continue;
      }
    }
    if (md[i] === "_" && boundary(i - 1)) {
      let end = md.indexOf("_", i + 1);
      while (end !== -1 && !boundary(end + 1)) end = md.indexOf("_", end + 1);
      if (end !== -1) {
        const inner = md.slice(i + 1, end);
        segments.push({ text: inner, bold: false, italic: true });
        plainParts.push(inner);
        i = end + 1;
        continue;
      }
    }
    let j = i;
    while (j < md.length && md[j] !== "*" && !(md[j] === "_" && boundary(j - 1))) j++;
    if (j === i) j = i + 1;
    segments.push({ text: md.slice(i, j), bold: false, italic: false });
    plainParts.push(md.slice(i, j));
    i = j;
  }
  return { plain: plainParts.join(""), segments };
}

// mermaid draws a label as HTML, so the four tags that name an ink a terminal owns are read; every other tag has
// no counterpart on a character grid and stays the text mermaid would have rendered.
const INK_TAG_RE = /<(\/?)(b|strong|i|em)\s*>/giu;

const HEAVY_TAGS = new Set(["b", "strong"]);

export function taggedSegments(text: string): MarkdownLabel | undefined {
  const tags = [...text.matchAll(INK_TAG_RE)];
  if (tags.length === 0) return undefined;
  const segments: LabelSegment[] = [];
  const plainParts: string[] = [];
  let bold = 0;
  let italic = 0;
  let at = 0;
  const take = (piece: string): void => {
    if (piece === "") return;
    segments.push({ text: piece, bold: bold > 0, italic: italic > 0 });
    plainParts.push(piece);
  };
  for (const tag of tags) {
    take(text.slice(at, tag.index));
    const step = tag[1] === "/" ? -1 : 1;
    if (HEAVY_TAGS.has(tag[2].toLowerCase())) bold = Math.max(0, bold + step);
    else italic = Math.max(0, italic + step);
    at = tag.index + tag[0].length;
  }
  take(text.slice(at));
  return { plain: plainParts.join(""), segments };
}

export function parseMarkdownLabel(text: string): MarkdownLabel | undefined {
  const stripped = text.trim();
  if (!(stripped.startsWith('"`') && stripped.endsWith('`"'))) return undefined;
  return markdownSegments(stripped.slice(2, -2));
}

const inked = (label: MarkdownLabel): MarkdownLabel | undefined =>
  label.segments.some((seg) => seg.bold || seg.italic) ? label : undefined;

// The one reading of a label a diagram draws rich. mermaid hands these to `createText` with its `markdown`
// option left at the default, which is TRUE, so the text is read as markdown whether or not the author wrapped
// it in the backticks of a markdown string: `**bold**` is bold in a state, a class or an entity alike. The
// backtick fence is taken off first where it stands, and the four HTML tags a terminal has an ink for are read
// where no markdown marker is. Nothing found means nothing to paint, and the caller keeps its plain path.
const FENCE_RE = /^"?`([\s\S]*)`"?$/u;

export const isFenced = (text: string): boolean => FENCE_RE.test(text.trim());

const unfencedSegments = (text: string): MarkdownLabel | undefined => {
  const tagged = taggedSegments(text);
  if (tagged !== undefined) return inked(tagged);
  return inked(markdownSegments(text));
};

export function richSegments(text: string): MarkdownLabel | undefined {
  // A markdown string is fenced in backticks, and the quotes around it are gone by the time some parsers hand
  // the label over, so both spellings are taken off before the markdown inside is read.
  const fenced = FENCE_RE.exec(text.trim()) ?? undefined;
  if (fenced !== undefined) return markdownSegments(fenced[1]);
  return unfencedSegments(text);
}

export interface RelationLabel {
  label: string;
  labelSegments: Array<LabelSegment[] | undefined> | undefined;
}

// A class relation's or an entity relationship's label: markdown with no fence taken off, so a backticked one
// is a code span mermaid 12 draws as the text it is, backticks and all. Each row is read on its own, and the
// label kept is what a reader sees.
export function relationLabel(text: string): RelationLabel {
  const rows = labelRowsOf(text).map((row) => (isFenced(row) ? undefined : unfencedSegments(row)));
  if (rows.every((row) => row === undefined)) return { label: text, labelSegments: undefined };
  return {
    label: rows.map((row, at) => row?.plain ?? labelRowsOf(text)[at]).join(LITERAL_NEWLINE),
    labelSegments: rows.map((row) => row?.segments),
  };
}

export const segmentsWidth = (row: readonly LabelSegment[]): number => row.reduce((sum, piece) => sum + displayWidth(piece.text), 0);

const BLANK_RE = /(\s+)/u;
const plainRun = (text: string): LabelSegment => ({ text, bold: false, italic: false });

// A word may straddle two inks (`**bo**ld`), so it is a row of its own pieces.
function wordsOf(runs: readonly LabelSegment[]): LabelSegment[][] {
  const words: LabelSegment[][] = [];
  let word: LabelSegment[] = [];
  for (const piece of runs) {
    for (const part of piece.text.split(BLANK_RE)) {
      if (part === "") continue;
      if (part.trim() === "") {
        if (word.length > 0) words.push(word);
        word = [];
      } else word.push({ ...piece, text: part });
    }
  }
  if (word.length > 0) words.push(word);
  return words;
}

export interface FoldedRow {
  width: number;
  pieces: () => LabelSegment[];
  plain: () => string;
}

// A row of inked runs folded on its words at any cap, each word keeping its inks and never cut: the words are read
// once, and each fold finds its breaks on their running widths, so folding at many caps costs a row, not a word.
export type Folding = (cap: number) => FoldedRow[];

export function foldingOf(runs: readonly LabelSegment[]): Folding {
  const total = segmentsWidth(runs);
  const wholePlain = runs.map((piece) => piece.text).join("");
  const whole: FoldedRow[] = [{ width: total, pieces: () => [...runs], plain: () => wholePlain }];
  const words = wordsOf(runs);
  // Before word `k`, the widths of the words ahead of it and a space after each.
  const ahead = [0];
  for (const word of words) ahead.push(ahead[ahead.length - 1] + segmentsWidth(word) + 1);
  const lastOf = (from: number, cap: number): number => {
    let [low, high] = [from, words.length - 1];
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (ahead[mid + 1] - ahead[from] - 1 <= cap) low = mid;
      else high = mid - 1;
    }
    return low;
  };
  const joined = (from: number, last: number) => (): LabelSegment[] =>
    words.slice(from, last + 1).flatMap((word, at) => (at === 0 ? [...word] : [plainRun(SPACE), ...word]));
  // A row's text, kept: a word too wide for the cap comes back whole at every narrower one.
  const plains = new Map<string, string>();
  const rowPlain = (from: number, last: number) => (): string => {
    const key = `${from}:${last}`;
    const plain = plains.get(key) ?? joined(from, last)().map((piece) => piece.text).join("");
    plains.set(key, plain);
    return plain;
  };
  return (cap) => {
    if (total <= cap || words.length === 0) return whole;
    const rows: FoldedRow[] = [];
    for (let from = 0; from < words.length; ) {
      const last = lastOf(from, cap);
      rows.push({ width: ahead[last + 1] - ahead[from] - 1, pieces: joined(from, last), plain: rowPlain(from, last) });
      from = last + 1;
    }
    return rows;
  };
}

export const wrapSegments = (runs: readonly LabelSegment[], cap: number): LabelSegment[][] => foldingOf(runs)(cap).map((row) => row.pieces());

// A label mermaid draws as markdown, fenced or not, as rows of inked runs: a row per `<br>` and per line end inside a
// string, bold and italic read, then each character reference the character it names, so `&lt;b&gt;` is text.
export const richRows = (text: string): LabelSegment[][] =>
  text
    .split(BR_RE)
    .flatMap((part) => part.split(NEWLINE))
    .map((line) => line.trim())
    .map((line) => (richSegments(line)?.segments ?? [plainRun(line)]).map((piece) => ({ ...piece, text: htmlDecoded(piece.text) })));

// What a reader sees of a rich label, the markers off it: every measurement of such a label goes through these,
// so a row is as wide as its letters and not as its syntax.
export const plainOf = (text: string): string => richSegments(text)?.plain ?? text;

export const shownWidth = (text: string): number => displayWidth(plainOf(text));

export const widestShown = (lines: readonly string[]): number => Math.max(0, ...lines.map(shownWidth));
