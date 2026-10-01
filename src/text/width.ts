import { FIRST_WIDE, isFullwidthOrWide } from "../tables/eastasianwidth.js";
import { ELLIPSIS, NEWLINE } from "./chars.js";
import { words as wordsOf } from "./format.js";

const WIDE_COLUMNS = 2;
const NARROW_COLUMNS = 1;

// The one column rule: the layout measures with it and the canvas advances with it, so a symbol the terminal draws
// in one cell (a star, a check mark, a medallion) is never given two.
export function isWideEastAsian(ch: string): boolean {
  return isFullwidthOrWide(ch.codePointAt(0) ?? 0);
}

// Under `FIRST_WIDE` nothing is wide and no code unit is half a surrogate pair, so the string measures its own
// length: the layout's millions of calls skip the code-point walk.
export function displayWidth(text: string): number {
  for (let at = 0; at < text.length; at++) {
    if (text.charCodeAt(at) >= FIRST_WIDE) return measured(text);
  }
  return text.length;
}

// An emoji asked for in colour by U+FE0F takes two cells as one glyph, the selector riding on its base.
const EMOJI_PRESENTATION = "\ufe0f";

export function glyphsOf(text: string): string[] {
  const glyphs: string[] = [];
  for (const ch of text) {
    const last = glyphs.length - 1;
    if (ch === EMOJI_PRESENTATION && last >= 0) glyphs[last] += ch;
    else glyphs.push(ch);
  }
  return glyphs;
}

export const isWideGlyph = (glyph: string): boolean => isWideEastAsian(glyph) || glyph.endsWith(EMOJI_PRESENTATION);

function measured(text: string): number {
  let width = 0;
  for (const ch of text) width += isWideEastAsian(ch) ? WIDE_COLUMNS : NARROW_COLUMNS;
  return width;
}


// These and no others: a scheme decides which program the desktop starts, so a `file://` or a `javascript:` under
// a hyperlink stays plain text.
const TERMINAL_SCHEMES = ["http://", "https://", "mailto:"];

export const terminalUrl = (raw: string): string | undefined => {
  const url = raw.trim();
  const lower = url.toLowerCase();
  return TERMINAL_SCHEMES.some((scheme) => lower.startsWith(scheme)) ? url : undefined;
};

// The text cut to the columns it fits in, never half a wide glyph.
export function clip(text: string, cols: number): string {
  const out: string[] = [];
  let width = 0;
  for (const ch of text) {
    const chWidth = isWideEastAsian(ch) ? WIDE_COLUMNS : NARROW_COLUMNS;
    if (width + chWidth > cols) break;
    out.push(ch);
    width += chWidth;
  }
  return out.join("");
}

// Columns and never characters (or rows, given a row count): a CJK glyph takes two cells, and counting `[...text].length` lays a title half
// its wide characters too far left. Does not clamp; what a text too wide does is the caller's to decide.
// An odd spare column always goes to the right, whatever the box or text parity.
export const centredOffset = (width: number, span: number): number => Math.floor((width - span) / 2);

export const centredAt = (width: number, text: string): number => centredOffset(width, displayWidth(text));

// The first column of a span centred on column `col`, its odd column falling left of `col`.
export const centredOnSpan = (col: number, span: number): number => col - Math.floor(span / 2);

export const centredOn = (col: number, text: string): number => centredOnSpan(col, displayWidth(text));

// `centredOn` held inside columns 0 to `room`, the left edge winning when the text is wider than the room.
export const clampedOn = (col: number, text: string, room: number): number => Math.min(Math.max(0, centredOn(col, text)), room - displayWidth(text));

export function truncateToWidth(text: string, width: number): string {
  if (displayWidth(text) <= width) return text;
  const ellipsisWidth = displayWidth(ELLIPSIS);
  if (width <= ellipsisWidth) return clip(ELLIPSIS, width);
  return clip(text, width - ellipsisWidth) + ELLIPSIS;
}

export const widestOf = (texts: readonly string[]): number => Math.max(0, ...texts.map(displayWidth));

export const widestLine = (text: string): number => widestOf(text.split(NEWLINE));

export const longestWord = (text: string): number => widestOf(text.split(/\s+/u));

// A text held whole while it fits `maxWidth`, folded on its words past it.
export function wordWrap(text: string, maxWidth: number): string[] {
  if (displayWidth(text) <= maxWidth) return [text];
  const words = wordsOf(text);
  if (words.length === 0) return [text];

  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    if (displayWidth(current) + 1 + displayWidth(word) <= maxWidth) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

// The first of the tries, looser to tighter, that the budget holds, else the narrowest, the earliest of equals; none
// is drawn past the first that fits.
export function firstFitting<C, T>(candidates: Iterable<C>, draw: (candidate: C) => T, widthOf: (drawn: T) => number, budget: number): T | undefined {
  let narrowest: T | undefined;
  let least = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const drawn = draw(candidate);
    const wide = widthOf(drawn);
    if (wide <= budget) return drawn;
    if (wide < least) {
      narrowest = drawn;
      least = wide;
    }
  }
  return narrowest;
}

// Every fold narrower than `widest`, widest first, down to one column.
export const descendingCaps = (widest: number): number[] => Array.from({ length: Math.max(0, widest - 1) }, (_, i) => widest - 1 - i);

// The first candidate that fits the budget, or the narrowest tried, kept only where it comes out narrower than `drawn`.
export function narrowerFit<C, T>(candidates: Iterable<C>, draw: (candidate: C) => T, widthOf: (drawn: T) => number, budget: number, drawn: T): T {
  const fitted = firstFitting(candidates, draw, widthOf, budget);
  return fitted !== undefined && widthOf(fitted) < widthOf(drawn) ? fitted : drawn;
}
