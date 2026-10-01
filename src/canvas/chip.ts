import type { Canvas } from "./canvas.js";
import { CHIP_TAIL } from "./keys.js";
import { putSegments } from "./rich.js";
import { clearRect, keyBlanks } from "./cells.js";
import type { LabelSegment } from "../source/markdown.js";
import { SPACE } from "../text/chars.js";
import { displayWidth } from "../text/width.js";
import { centredLabelRows, labelLines, widestLabelLine } from "../text/labels.js";

// A label on a ground of its own, a name tag: one blank each side of the words, on the words' ground.
export const CHIP_PAD = SPACE;

export const chipped = (text: string): string => `${CHIP_PAD}${text}${CHIP_PAD}`;

export const chipWidth = (text: string): number => displayWidth(chipped(text));

// The cells one pad of a chip takes, each side of its words.
export const CHIP_INSET = displayWidth(CHIP_PAD);

// The cells a stamped chip takes across: its widest row and a pad each side.
export const stampedWidth = (label: string): number => widestLabelLine(label) + 2 * CHIP_INSET;

export const chipKey = (key: string): string => `${key}${CHIP_TAIL}`;

// Writes ` text ` from `col`, every cell of it, the blanks too, keyed as a chip of `key`.
export function putChip(canvas: Canvas, row: number, col: number, text: string, key: string): void {
  const chip = chipKey(key);
  canvas.putText(row, col, chipped(text), chip);
  const last = col + chipWidth(text) - CHIP_INSET;
  for (const at of [col, last]) if (canvas.get(row, at) === SPACE) canvas.setStyle(row, at, chip);
}

// The weights of a label's pieces, one list per row of it, as its markdown reads them.
export type RowSegments = ReadonlyArray<readonly LabelSegment[] | undefined>;

// Writes a label of several rows from its block's top left, each row centred in the widest and in its own weights.
export function putLabelRows(canvas: Canvas, row: number, col: number, label: string, style: string, segments: RowSegments | undefined = undefined): void {
  for (const [down, [at, text]] of centredLabelRows(label).entries()) putSegments(canvas, row + down, col + at, text, segments?.[down], style);
}

// The row a label of several rows starts on to stand centred on `row`, the extra row of an even count below it.
export const chipTop = (row: number, label: string): number => row - Math.floor((labelLines(label) - 1) / 2);

// A label stamped over what stood there from `top`, its whole block blank but for the words and keyed `style`.
export function stampChip(canvas: Canvas, top: number, col: number, label: string, style: string, segments: RowSegments | undefined = undefined): void {
  const width = stampedWidth(label);
  clearRect(canvas, top, col, labelLines(label), width);
  putLabelRows(canvas, top, col + CHIP_INSET, label, style, segments);
  keyBlanks(canvas, top, col, labelLines(label), width, style);
}
