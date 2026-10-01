import { Canvas, DEFAULT_STYLE } from "./canvas.js";
import { BAND_MARK, CHIP_TAIL, CLUSTER_TAIL, COMPOSITE, OUT_TAIL, SLAB_TAIL, SUBGRAPH_FILL, WALL_TAIL, inkApart } from "./keys.js";
import { SPACE } from "../text/chars.js";

// What one cell of a cluster's ground takes: a blank takes the fill key, and a cell already carrying ink keeps it
// with the ground added under. A key that already names a ground of its own is left alone, which is what keeps a
// styled box on its own colour inside the frame and a band already laid on its own. A label's chip is told the
// ground it stands on, letters and padding alike: a chip the theme leaves bare shows that ground, never the page.
function ground(canvas: Canvas, r: number, c: number, fill: string, tail: string): void {
  const key = canvas.getStyle(r, c);
  if (key.endsWith(CHIP_TAIL)) {
    canvas.setStyle(r, c, `${key}${tail}`);
    return;
  }
  if (canvas.get(r, c) === SPACE) {
    // A blank under a plain key, the gap of a dashed rule, has no ink to keep and is ground like any other.
    if (key === DEFAULT_STYLE || !key.includes(COMPOSITE)) canvas.setStyle(r, c, fill);
    return;
  }
  // An ink laid before the ground, a `stroke:` on a box, is set aside: the ground goes under the key it was laid on.
  // A band is a ground of its own, and keeps it.
  const [base, ink] = inkApart(key);
  if (key.includes(BAND_MARK) || base.includes(COMPOSITE) && !base.endsWith(OUT_TAIL) && !base.endsWith(SLAB_TAIL)) return;
  canvas.setStyle(r, c, `${base}${tail}${ink}`);
}

// The ground a cluster lays under everything inside it, subgraph or namespace alike. A frame nested inside keeps its
// wall (`@wall`) as it is, on its own ground, where `fillBand` swaps the wall of the frame it grounds.
// `walls` and `rules` say how many cells the ground stands off the two pairs of borders: a border drawn on the OUTER
// edge of its cell leaves the rest of that cell inside the frame and takes 0, one drawn on the inner edge takes 1.
export function fillCluster(canvas: Canvas, x: number, y: number, width: number, height: number, walls: number, rules = 1): void {
  if (width <= 2 || height <= 2) return;
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  for (let r = top + rules; r < top + height - rules; r++) {
    for (let c = left + walls; c < left + width - walls; c++) ground(canvas, r, c, SUBGRAPH_FILL, CLUSTER_TAIL);
  }
}

// A band of rows the cluster's own ground never reaches, laid FIRST so the fill that follows leaves it alone.
export function fillBand(canvas: Canvas, left: number, right: number, top: number, bottom: number, fill: string, tail: string): void {
  for (let r = Math.max(0, top); r <= bottom; r++) {
    for (let c = Math.max(0, left); c <= right; c++) {
      // A frame's wall carries the frame's ground in its own key (`@wall`), the cluster fill never reaching it. Inside
      // the band the frame's ground is the band's, so the tail is swapped. A box's wall (`@rim`) stands on the box's
      // fill and, like every other key that names a ground of its own, is left alone.
      const key = canvas.getStyle(r, c);
      if (key.endsWith(WALL_TAIL)) canvas.setStyle(r, c, `${key.slice(0, -WALL_TAIL.length)}${tail}`);
      else ground(canvas, r, c, fill, tail);
    }
  }
}
