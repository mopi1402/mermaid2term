import { type Edge } from "../model.js";
import { laneId, type CellSet } from "./pathfinder.js";
import type { Point } from "../../canvas/cells.js";

// Each cell is remembered with the DIRECTION the run takes it in: two edges lying on one cell the same way draw as
// a single line, where crossing it is a crossing the drawing tells apart on its own.
export function lanesOf(gridPath: Point[], from = 1, to = gridPath.length - 1): string[] {
  const taken: string[] = [];
  for (let i = from; i <= to; i++) {
    const [fromCol, fromRow] = gridPath[i - 1];
    const [toCol, toRow] = gridPath[i];
    const alongRow = fromRow === toRow;
    const step = alongRow ? Math.sign(toCol - fromCol) : Math.sign(toRow - fromRow);
    if (step === 0) continue;
    const from = alongRow ? fromCol : fromRow;
    const to = alongRow ? toCol : toRow;
    for (let at = from; at !== to + step; at += step) {
      taken.push(alongRow ? laneId(at, fromRow, true) : laneId(fromCol, at, false));
    }
  }
  return taken;
}

export const arrivesAt = (nodeId: string): string => `into ${nodeId}`;

export const leavesFrom = (nodeId: string): string => `out of ${nodeId}`;

export const STEM_CELLS = 2;

export const stemInto = (nodeId: string): string => `stem into ${nodeId}`;

export const stemOut = (nodeId: string): string => `stem out of ${nodeId}`;

export const remember = (spread: Map<string, string[]>, key: string, taken: string[]): void => {
  const held = spread.get(key);
  if (held === undefined) spread.set(key, taken);
  else held.push(...taken);
};

// Whether two runs share an end, a frame standing for every box it holds.
export type Kin = (a: Edge, b: Edge) => boolean;

export function lanesFor(
  edge: Edge,
  lanes: Map<string, number>,
  spread: Map<string, string[]>,
  riders: ReadonlyMap<string, readonly Edge[]> = new Map(),
  kin: Kin = () => true
): { held: CellSet; kinCells: Set<string> } {
  const moved = new Map<string, number>();
  const kinCells = new Set<string>();
  const laneKeys = new Set([
    arrivesAt(edge.target),
    leavesFrom(edge.source),
    stemOut(edge.target),
    stemInto(edge.source),
  ]);
  for (const key of laneKeys) {
    for (const lane of spread.get(key) ?? []) moved.set(lane, (moved.get(lane) ?? 0) + 1);
  }
  const stemKeys = new Set([
    stemInto(edge.target),
    stemOut(edge.source),
    stemOut(edge.target),
    stemInto(edge.source),
  ]);
  for (const key of stemKeys) {
    for (const lane of spread.get(key) ?? []) kinCells.add(lane.slice(2));
  }
  // A kin's stem is shared freely, unless a run with no end in common already rides it.
  const stranger = (lane: string): boolean => (riders.get(lane) ?? []).some((rider) => !kin(rider, edge));
  const held: CellSet = {
    has: (lane) =>
      kinCells.has(lane.slice(2)) ? stranger(lane) : (lanes.get(lane) ?? 0) > (moved.get(lane) ?? 0),
  };
  return { held, kinCells };
}
