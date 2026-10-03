import { formatHex } from "../../src/colour/rgb.js";
import { CODE_SEPARATOR, CSI, ESC } from "../../src/paint/escapes.js";
import { cellsPlain, type Cell as TextCell } from "../../src/paint/cells.js";
import { type Text } from "../../src/paint/text.js";
import { NEWLINE } from "../../src/text/chars.js";
import { isWideGlyph } from "../../src/text/width.js";
import { GROUND, INK } from "./ansi.js";

// One column of a painted drawing: the glyph it shows, the ground under it, and the canvas key it was painted from.
export interface Cell {
  readonly ch: string;
  readonly ground: string;
  readonly owner: string;
}

// The cell a wide glyph spills into, standing on the same ground and owned alike.
const SPILL = "";
const ON = "on";
export const REVERSE = "reverse";

// The ground a style lays: the colour after `on`, reverse video, or none.
function groundOf(style: string): string {
  const words = style.split(/\s+/u);
  const on = words.indexOf(ON);
  if (on !== -1) return (words[on + 1] ?? "").toLowerCase();
  return words.includes(REVERSE) ? REVERSE : "";
}

// A painted drawing laid out in columns, a wide glyph holding two as the terminal lays it.
export function gridOf(text: Text): Cell[][] {
  return text.rows.map((row) => {
    const cells: Cell[] = [];
    for (const { ch, style, owner = "" } of row) {
      const cell = { ch, ground: groundOf(style), owner };
      cells.push(cell);
      if (isWideGlyph(ch)) cells.push({ ...cell, ch: SPILL });
    }
    return cells;
  });
}

// The cells about the first `word` a drawing writes: its own, the one before it, and the first ink left of it.
export function aroundWord(text: Text, word: string): { word: readonly TextCell[]; before: TextCell | undefined; wall: TextCell | undefined } {
  const row = text.rows.find((cells) => cellsPlain(cells).includes(word)) ?? [];
  const at = cellsPlain(row).indexOf(word);
  return { word: row.slice(at, at + word.length), before: row[at - 1], wall: row.slice(0, at).reverse().find((cell) => cell.ch !== " ") };
}

// One glyph of an ANSI row with the true-colour ink and ground its SGR run lays on it, `#rrggbb` or "" for none.
export interface PaintedCell {
  readonly ch: string;
  readonly ink: string;
  readonly ground: string;
  readonly reverse: boolean;
}

const SGR_AT_RE = new RegExp(`${ESC}\\[([0-9;]*)m`, "uy");
const RESET_CODE = "0";
const REVERSE_CODE = "7";
const TRUE_COLOUR = "2";
const INDEXED = "5";
const CHANNELS = 3;

// Each glyph of an ANSI row, in the ink and ground the SGR sequences before it leave.
export function paintedCells(row: string): PaintedCell[] {
  const cells: PaintedCell[] = [];
  let ink = "";
  let ground = "";
  let reverse = false;
  for (let at = 0; at < row.length; ) {
    SGR_AT_RE.lastIndex = at;
    const sgr = row.startsWith(CSI, at) ? (SGR_AT_RE.exec(row) ?? undefined) : undefined;
    if (sgr === undefined) {
      const ch = String.fromCodePoint(row.codePointAt(at) ?? 0);
      cells.push({ ch, ink, ground, reverse });
      at += ch.length;
      continue;
    }
    const codes = sgr[1].split(CODE_SEPARATOR);
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (code === "" || code === RESET_CODE) [ink, ground, reverse] = ["", "", false];
      else if (code === REVERSE_CODE) reverse = true;
      else if ((code === INK || code === GROUND) && codes[i + 1] === TRUE_COLOUR) {
        const [r, g, b] = codes.slice(i + 2, i + 2 + CHANNELS).map(Number);
        const colour = formatHex({ r, g, b }).toLowerCase();
        if (code === INK) ink = colour;
        else ground = colour;
        i += 1 + CHANNELS;
      } else if ((code === INK || code === GROUND) && codes[i + 1] === INDEXED) i += 2;
    }
    at += sgr[0].length;
  }
  return cells;
}

export const paintedGrid = (ansi: string): PaintedCell[][] => ansi.split(NEWLINE).map(paintedCells);
