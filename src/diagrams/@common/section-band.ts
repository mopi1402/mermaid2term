import { displayWidth, widestOf, wordWrap } from "../../text/width.js";
import { spanOf } from "../../canvas/extent.js";

const folded = (text: string, room: number): string[] => (displayWidth(text) <= room ? [text] : wordWrap(text, room));

export interface SectionBand {
  readonly lines: string[];
  readonly widths: number[];
}

// A section's name over the columns it spans: folded at `room`, and the columns widened, evenly and the first ones
// taking what is left, where its widest line and the `pad` around it still do not fit.
export function sectionBand(
  title: string,
  room: number,
  widths: readonly number[],
  gap: number,
  pad: number,
  fold: (text: string, room: number) => string[] = folded
): SectionBand {
  const lines = fold(title, Math.max(1, room));
  const n = widths.length;
  const extra = widestOf(lines) + pad - spanOf(widths, gap);
  if (extra <= 0 || n === 0) return { lines, widths: [...widths] };
  return { lines, widths: widths.map((width, i) => width + Math.floor(extra / n) + (i < extra % n ? 1 : 0)) };
}
