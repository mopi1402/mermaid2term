import type { Layout } from "./model.js";
import { MARGIN } from "./metrics.js";

// Two stacked parts stand three blank rows apart, the height a terminal cell pair gives the four columns between two
// parts side by side, so the families read evenly spaced both ways.
const FAMILY_GAP_ROWS = 3;
const ROW_OVERLAP = 2 * MARGIN - FAMILY_GAP_ROWS;

type Merged = Pick<Layout, "positions" | "sizes" | "layerOf" | "frames" | "loops">;

// Copies a layout laid on its own into a larger one, moved by `dx` and `dy`.
export function mergeShifted(into: Merged, part: Layout, dx: number, dy: number): void {
  for (const [name, [x, y]] of part.positions) into.positions.set(name, [x + dx, y + dy]);
  for (const [name, size] of part.sizes) into.sizes.set(name, size);
  for (const [name, layer] of part.layerOf) into.layerOf.set(name, layer);
  for (const frame of part.frames) into.frames.push({ ...frame, x: frame.x + dx, y: frame.y + dy });
  for (const [name, side] of part.loops) into.loops.set(name, side);
}

// Parts laid side by side until the budget is spent, then on a row of their own: the width a terminal gives is used
// before the height it does not. A part wider than the budget takes its row alone rather than being cut.
export function packed(parts: Layout[], budget: number): Layout {
  const positions = new Map<string, [number, number]>();
  const sizes = new Map<string, [number, number]>();
  const layerOf = new Map<string, number>();
  const frames: Layout["frames"] = [];
  const loops = new Map<string, number>();
  let width = 0;
  let height = 0;
  let rowX = 0;
  let rowY = 0;
  let rowHeight = 0;
  for (const part of parts) {
    if (rowX > 0 && rowX + part.width > budget) {
      rowY += rowHeight - ROW_OVERLAP;
      rowX = 0;
      rowHeight = 0;
    }
    const dx = rowX;
    const dy = rowY;
    mergeShifted({ positions, sizes, layerOf, frames, loops }, part, dx, dy);
    rowX += part.width;
    rowHeight = Math.max(rowHeight, part.height);
    width = Math.max(width, rowX);
    height = Math.max(height, rowY + part.height);
  }
  return { positions, sizes, width: width + MARGIN, height: height + MARGIN, layerOf, frames, loops };
}
