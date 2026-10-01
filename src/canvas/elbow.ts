import type { Canvas } from "./canvas.js";
import type { CharSet } from "./model.js";
import { cornerOf, type Toward } from "./corners.js";
import { must } from "../must.js";
import type { CrossingCut } from "./crossings.js";

interface Bend {
  merge: boolean;
  acrossOut: number;
  bendRow: number | undefined;
  // Where given, the line runs across first and turns down this column.
  bendCol: number | undefined;
  rounded: boolean;
  heavy: boolean;
  cut: CrossingCut | undefined;
}

const DEFAULT_BEND: Bend = { merge: true, acrossOut: 0, bendRow: undefined, bendCol: undefined, rounded: false, heavy: false, cut: undefined };

export type RowCol = readonly [row: number, col: number];

interface Stroke {
  hChar: string;
  vChar: string;
  cs: CharSet;
  style: string;
  // Whether a corner merges with what stands under it; the legs always do.
  merge: boolean;
  rounded: boolean;
  heavy: boolean;
  // The way the run leaves its last point where it goes on undrawn, which turns a corner there too.
  trail: Toward | undefined;
  // Shared by every run of one drawing, so a run crossing another is cut rather than merged into a `┼`.
  cut?: CrossingCut | undefined;
}

const vertical = (toward: Toward): boolean => toward === "up" || toward === "down";

// Strokes a run through `points`, `headings` naming the way each leg goes (a leg of no length still has one): every
// leg inclusive of both ends, then a corner at every point the run turns at.
export function drawPolyline(canvas: Canvas, points: readonly RowCol[], headings: readonly Toward[], stroke: Stroke): void {
  const { hChar, vChar, cs, style, merge, rounded, heavy, trail, cut } = stroke;
  headings.forEach((toward, i) => {
    const [[r1, c1], [r2, c2]] = [points[i], points[i + 1]];
    const down = vertical(toward);
    if (down) canvas.drawVertical(c1, r1, r2, vChar, style);
    else canvas.drawHorizontal(r1, c1, c2, hChar, style);
    if (cut === undefined) return;
    const [lo, hi] = down ? [Math.min(r1, r2), Math.max(r1, r2)] : [Math.min(c1, c2), Math.max(c1, c2)];
    for (let at = lo + 1; at < hi; at++) cut.along(down ? c1 : at, down ? at : r1, !down, vChar, style);
  });
  cut?.cut(canvas);
  const turn = ([row, col]: RowCol, inward: Toward, outward: Toward): void =>
    canvas.put(row, col, must(cornerOf(inward, outward, cs, rounded, heavy)), merge, style);
  for (let i = 1; i < headings.length; i++) turn(points[i], headings[i - 1], headings[i]);
  if (trail !== undefined) turn(points[headings.length], headings[headings.length - 1], trail);
}

export function drawRoutedLine(
  canvas: Canvas,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  hChar: string,
  vChar: string,
  cs: CharSet,
  style: string,
  bend: Partial<Bend> = {}
): void {
  const { merge, acrossOut, bendRow, bendCol: givenCol, rounded, heavy, cut } = { ...DEFAULT_BEND, ...bend };
  const draw = (points: readonly RowCol[], headings: readonly Toward[]): void =>
    drawPolyline(canvas, points, headings, { hChar, vChar, cs, style, merge, rounded, heavy, trail: undefined, cut });
  if (c1 === c2) {
    draw([[r1, c1], [r2, c2]], ["down"]);
    return;
  }
  if (r1 === r2) {
    draw([[r1, c1], [r2, c2]], ["right"]);
    return;
  }

  if (acrossOut > 0 || givenCol !== undefined) {
    const toward = c2 > c1 ? 1 : -1;
    const bendCol = givenCol ?? (Math.abs(c2 - c1) > acrossOut * 2 ? c1 + toward * acrossOut : Math.floor((c1 + c2) / 2));
    const across = toward > 0 ? "right" : "left";
    const along = r2 > r1 ? "down" : "up";
    draw([[r1, c1], [r1, bendCol], [r2, bendCol], [r2, c2]], [across, along, across]);
    return;
  }

  const midRow = bendRow ?? Math.floor((r1 + r2) / 2);
  const across = c2 < c1 ? "left" : "right";
  draw([[r1, c1], [midRow, c1], [midRow, c2], [r2, c2]], [r1 < midRow ? "down" : "up", across, r2 > midRow ? "down" : "up"]);
}
