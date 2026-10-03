import { cellId } from "../../canvas/geometry.js";
import { Direction, isHorizontal } from "../model.js";
import { makePlacement, STRIDE, type GridLayout } from "./grid.js";
import { type GridCoord } from "./laid.js";

function canPlace(layout: GridLayout, at: GridCoord): boolean {
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) if (!layout.isFree(at.col + dc, at.row + dr)) return false;
  }
  return true;
}

// Seats `id` at `wanted`, or the first free cell past it across the flow when another box holds it.
function seat(layout: GridLayout, id: string, wanted: GridCoord, horizontal: boolean): void {
  let at = wanted;
  while (!canPlace(layout, at)) {
    at = horizontal ? { col: at.col, row: at.row + STRIDE } : { col: at.col + STRIDE, row: at.row };
  }
  layout.placements.set(id, makePlacement(id, at));
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) layout.gridOccupied.set(cellId(at.col + dc, at.row + dr), id);
  }
}

export function placeNodes(
  layout: GridLayout,
  layerOrder: string[][],
  direction: Direction,
  gapExpansions: Map<number, number> = new Map(),
  flank = 0
): void {
  const horizontal = isHorizontal(direction);
  let extra = 0;
  layerOrder.forEach((nodes, layer) => {
    if (layer > 0) extra += gapExpansions.get(layer - 1) ?? 0;
    nodes.forEach((id, pos) => {
      const at: GridCoord = horizontal
        ? { col: layer * STRIDE + 1 + extra, row: pos * STRIDE + 1 + flank }
        : { col: pos * STRIDE + 1 + flank, row: layer * STRIDE + 1 + extra };
      seat(layout, id, at, horizontal);
    });
  });
}

// Every node on the column and row the source's edge sides gave it, so a cell nothing claims stays a gap.
export function placeOnGrid(
  layout: GridLayout,
  order: readonly string[],
  positions: ReadonlyMap<string, readonly [number, number]>,
  direction: Direction
): void {
  const horizontal = isHorizontal(direction);
  for (const id of order) {
    const [col, row] = positions.get(id) ?? [0, 0];
    seat(layout, id, { col: col * STRIDE + 1, row: row * STRIDE + 1 }, horizontal);
  }
}
