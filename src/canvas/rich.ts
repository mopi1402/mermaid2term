import type { Canvas } from "./canvas.js";
import { inkRuns } from "./keys.js";
import { plainOf, richSegments, type LabelSegment } from "../source/markdown.js";
import { centredAt } from "../text/width.js";

// One row of text already read: each piece in the weight it asks for, the key the caller draws under beneath it.
export function putSegments(canvas: Canvas, row: number, col: number, text: string, segments: readonly LabelSegment[] | undefined, style: string): void {
  if (segments === undefined) canvas.putText(row, col, text, style);
  else canvas.putStyledText(row, col, inkRuns(segments, "", style));
}

// One row of text written where mermaid reads it as markdown: the marked pieces take their own ink and the
// rest keeps the key the caller draws under, the markers themselves never reaching a cell. The text handed in
// is the one the source wrote, markers and all; whoever measured the row measured it through `plainOf`.
export function writeRich(canvas: Canvas, row: number, col: number, text: string, style: string): void {
  putSegments(canvas, row, col, text, richSegments(text)?.segments, style);
}

// A markdown row centred in `width` cells from `x` on the letters it shows; the column it starts on.
export function writeCentred(canvas: Canvas, row: number, x: number, width: number, text: string, style: string): number {
  const left = x + centredAt(width, plainOf(text));
  writeRich(canvas, row, left, text, style);
  return left;
}
