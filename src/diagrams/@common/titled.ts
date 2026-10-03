import { Canvas } from "../../canvas/canvas.js";
import { LABEL } from "../../canvas/keys.js";
import { blankCell, blankColumns, inkedWidth } from "../../canvas/extent.js";
import { centredAt, centredOffset, displayWidth } from "../../text/width.js";
import { titleLines } from "../../text/labels.js";

export const TITLE_GAP = 1;

// Where a title stands: centred when `left` is unsaid, over the `over` span when given, folded on words past `budget`.
export interface TitleSeat {
  readonly key: string;
  readonly left: number | undefined;
  readonly budget: number | undefined;
  readonly over?: Span | undefined;
}

const CENTRED: TitleSeat = { key: LABEL, left: undefined, budget: undefined };

// A line's first column: the lines' block centred over the span, held inside the drawing, each line centred in it.
type Span = readonly [left: number, width: number];

export const seatOf = (fixed: number | undefined, over: Span | undefined, wide: number, block: number, line: string): number => {
  if (fixed !== undefined) return fixed;
  if (over === undefined) return centredAt(wide, line);
  const [left, width] = over;
  const start = Math.max(0, Math.min(wide - block, left + centredOffset(width, block)));
  return start + centredAt(block, line);
};

// A title's rows: whole with no budget, folded on words inside the budget or the drawing where wider, `left` kept clear.
export const foldedTitle = (title: string, budget: number | undefined, drawn: number, left = 0): string[] =>
  titleLines(title, budget === undefined ? Number.POSITIVE_INFINITY : Math.max(1, Math.max(budget, drawn) - left));

export const blockOf = (lines: readonly string[]): number => Math.max(...lines.map(displayWidth));

// Lays folded rows from `row`, each where `seatOf` stands it over a drawing `wide` columns across.
export function putSeated(canvas: Canvas, row: number, lines: readonly string[], seat: Omit<TitleSeat, "budget">, wide: number): void {
  const block = blockOf(lines);
  lines.forEach((line, i) => canvas.putText(row + i, seatOf(seat.left, seat.over, wide, block, line), line, seat.key));
}

const blankRow = (canvas: Canvas, row: number): boolean => {
  for (let c = 0; c < canvas.width; c++) if (!blankCell(canvas, row, c)) return false;
  return true;
};

// The body's `title` stands where a frontmatter one would: over the drawing, one row clear of it, the drawing
// widened to hold it within its budget.
export function titledAbove(drawing: Canvas, title: string, seat: TitleSeat = CENTRED): Canvas {
  if (title === "") return drawing;
  let top = 0;
  while (top < drawing.height - 1 && blankRow(drawing, top)) top += 1;
  // A seat not fixed to a column drops the blank columns left of the drawing, as it drops the blank rows over it.
  const shift = seat.left === undefined ? blankColumns(drawing) : 0;
  const over: Span | undefined = seat.over === undefined ? undefined : [seat.over[0] - shift, seat.over[1]];
  const drawn = inkedWidth(drawing) - shift;
  const lines = foldedTitle(title, seat.budget, drawn, seat.left);
  const wide = Math.max(drawn, (seat.left ?? 0) + blockOf(lines));
  const rows = lines.length + TITLE_GAP;
  const canvas = new Canvas(Math.max(drawing.width - shift, wide), drawing.height - top + rows);
  canvas.stamp(drawing, rows - top, -shift);
  putSeated(canvas, 0, lines, { key: seat.key, left: seat.left, over }, over === undefined ? wide : canvas.width);
  return canvas;
}
