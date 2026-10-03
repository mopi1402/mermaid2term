import { isHorizontal, normalized, type Graph } from "../model.js";
import { axisOf } from "../axis.js";
import { placedEdges } from "./edges.js";
import { MIN_APPROACH, type GridLayout, UNSIZED } from "./grid.js";

export function expandNodesForFans(graph: Graph, layout: GridLayout): void {
  const horizontal = isHorizontal(normalized(graph.direction));
  const seats = new Map<string, { out: number; into: number }>();
  const seat = (nodeId: string): { out: number; into: number } => {
    const held = seats.get(nodeId) ?? { out: 0, into: 0 };
    seats.set(nodeId, held);
    return held;
  };

  for (const { edge, src: source, tgt: target } of placedEdges(graph, layout)) {
    const from = axisOf(horizontal).along(source);
    const to = axisOf(horizontal).along(target);
    if (from === to) continue;
    if (from < to) {
      seat(edge.source).out += 1;
      seat(edge.target).into += 1;
    } else {
      seat(edge.target).out += 1;
    }
  }

  for (const [id, held] of seats) {
    const placement = layout.placements.get(id);
    if (placement === undefined) continue;
    const needed = Math.max(held.out, held.into);
    const track = axisOf(horizontal).across(placement);
    const sizes = horizontal ? layout.rowHeights : layout.colWidths;
    const size = Math.max(sizes.get(track) ?? UNSIZED, needed);
    // Never exactly TWO: it is the one size with no middle cell, so the attach lands on one of the pair and the side
    // beside it holds nothing.
    sizes.set(track, size === 2 ? 3 : size);
  }
}

const sideKey = (nodeId: string, gap: number): string => `${nodeId} ${gap}`;

const SPREAD_ROOM = 2 * MIN_APPROACH - 1;

export function expandGapsForSpreads(graph: Graph, layout: GridLayout): void {
  if (!isHorizontal(normalized(graph.direction))) return;

  const sides = new Map<string, { gap: number; arrivals: number; diagonals: number }>();
  const attaching = (nodeId: string, gap: number): { gap: number; arrivals: number; diagonals: number } => {
    const held = sides.get(sideKey(nodeId, gap)) ?? { gap, arrivals: 0, diagonals: 0 };
    sides.set(sideKey(nodeId, gap), held);
    return held;
  };

  for (const { edge, src: source, tgt: target } of placedEdges(graph, layout)) {
    if (source.grid.col === target.grid.col) continue;
    if (target.grid.col < source.grid.col) continue;
    const held = attaching(edge.target, target.grid.col - 2);
    held.arrivals += 1;
    if (source.grid.row !== target.grid.row) held.diagonals += 1;
  }

  for (const { gap, arrivals, diagonals } of sides.values()) {
    if (arrivals < 2 || diagonals < 1 || gap < 0) continue;
    layout.colWidths.set(gap, Math.max(layout.colWidths.get(gap) ?? UNSIZED, SPREAD_ROOM));
  }
}
