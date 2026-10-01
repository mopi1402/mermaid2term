import { type Canvas } from "./canvas.js";
import { ALT_TAIL, BODY_TAIL, CLUSTER_TAIL, OUT_TAIL, RIM_TAIL, TITLE_TAIL, WALL_TAIL, bandApart, gradientMarked } from "./keys.js";
import { SPACE } from "../text/chars.js";

// The tails a stroke is drawn under: bare, outside its shape, over its fill, on a cluster's ground, on a composite's
// title band or body. A label, a fill or a slab is not the stroke, and keeps the colour it has.
const STROKE_TAILS = ["", OUT_TAIL, RIM_TAIL, WALL_TAIL, ...[CLUSTER_TAIL, TITLE_TAIL, BODY_TAIL, ALT_TAIL].flatMap((ground) => [ground, OUT_TAIL + ground, RIM_TAIL + ground, WALL_TAIL + ground])];

// The ground a box stands on, laid under its whole key, says nothing of whether the cell is its stroke.
const strokeOf = (key: string, owner: string): boolean => {
  const own = bandApart(key)[0];
  return own.startsWith(owner) && STROKE_TAILS.includes(own.slice(owner.length));
};

// Each border cell is marked with the box it belongs to; a cell another owner drew keeps its key untouched.
function mark(canvas: Canvas, r: number, c: number, owners: readonly string[], index: () => number, kept: readonly string[]): void {
  if (canvas.get(r, c) === SPACE || canvas.isText(r, c) || kept.includes(canvas.get(r, c))) return;
  const key = canvas.getStyle(r, c);
  if (owners.some((owner) => strokeOf(key, owner))) canvas.setStyle(r, c, gradientMarked(key, index()));
}

export interface StrokedBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  // The keys its border is drawn under.
  readonly owners: readonly string[];
  // The glyphs that keep the border's ink, signs rather than stretches of the stroke.
  readonly kept?: readonly string[];
  // Whether each cell marked is a box of its own, taking the gradient's first step.
  readonly perCell?: boolean;
}

export const bySize = <T extends { readonly width: number; readonly height: number }>(boxes: readonly T[]): T[] =>
  [...boxes].sort((a, b) => a.width * a.height - b.width * b.height);

// Each box marked with a gradient of its own, in the order given: a cell marked first is no longer a bare stroke.
export function markInOrder(canvas: Canvas, boxes: readonly StrokedBox[]): void {
  let next = 0;
  for (const box of boxes) {
    const index = next++;
    const at = box.perCell === true ? (): number => next++ : (): number => index;
    for (let r = box.y; r < box.y + box.height; r++) {
      for (let c = box.x; c < box.x + box.width; c++) mark(canvas, r, c, box.owners, at, box.kept ?? []);
    }
  }
}

// The boxes a kind drawing on its own canvas knows, each with a gradient of its own: the smallest first, so a box
// inside a frame is marked before the frame reaches its cells.
export const markBoxes = (canvas: Canvas, boxes: readonly StrokedBox[]): void => markInOrder(canvas, bySize(boxes));
