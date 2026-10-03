import { type Edge } from "../model.js";
import { edgesOfPlaced, type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { boxCells, edgesOf, ringCells } from "../../canvas/extent.js";
import { cellId } from "./pathfinder.js";
import type { Point } from "../../canvas/cells.js";
import { AttachDir } from "../sides.js";
import { pathCells } from "../../canvas/geometry.js";
import { addInto } from "../../must.js";

export interface RoutedEdge {
  edge: Edge;
  gridPath: Point[];
  drawPath: Array<[number, number]>;
  startDir: AttachDir;
  endDir: AttachDir;
  label: string;
  index: number;
  occupiedCells: Set<string>;
}

const LIFT_ROUNDS = 8;

export interface Marks {
  corners: Map<string, Set<number>>;
  passes: Map<string, Map<number, boolean>>;
  ends: Map<string, Set<number>>;
}

export function markPaths(routed: RoutedEdge[]): Marks {
  const marks: Marks = { corners: new Map(), passes: new Map(), ends: new Map() };
  routed.forEach((re, index) => {
    const path = re.drawPath;
    if (path.length < 2) return;
    path.forEach(([x, y], k) => {
      addInto(k === 0 || k === path.length - 1 ? marks.ends : marks.corners, cellId(x, y), index);
    });
    for (let k = 0; k + 1 < path.length; k++) {
      const [x1, y1] = path[k];
      const [x2, y2] = path[k + 1];
      const alongRow = y1 === y2;
      const from = alongRow ? x1 : y1;
      const to = alongRow ? x2 : y2;
      const step = Math.sign(to - from);
      if (step === 0) continue;
      for (let a = from + step; a !== to; a += step) {
        const cell = alongRow ? cellId(a, y1) : cellId(x1, a);
        const held = marks.passes.get(cell);
        if (held === undefined) marks.passes.set(cell, new Map([[index, alongRow]]));
        else held.set(index, alongRow);
      }
    }
  });
  return marks;
}

// Safe to hand back: a move builds a fresh `placements` rather than writing to one, and no caller writes to the
// set. Six passes per routing run, one run per rung of the fit ladder, 140 of 168 asks carrying the same objects.
const lastSolid = new WeakMap<GridLayout, { sgBounds: ReadonlyMap<string, SubgraphBounds>; solid: Set<string> }>();

export function solidCells(layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>): Set<string> {
  const held = lastSolid.get(layout);
  if (held !== undefined && held.sgBounds === sgBounds) return held.solid;
  const solid = new Set<string>();
  for (const p of layout.placements.values()) for (const [r, c] of boxCells(edgesOfPlaced(p))) solid.add(cellId(c, r));
  for (const { x, y, width, height } of sgBounds.values()) {
    if (width > 0 && height > 0) for (const [r, c] of ringCells(edgesOf({ x, y, w: width, h: height }))) solid.add(cellId(c, r));
  }
  lastSolid.set(layout, { sgBounds, solid });
  return solid;
}

export function segmentAt(path: Array<[number, number]>, x: number, y: number): number | undefined {
  for (let k = 0; k + 1 < path.length; k++) {
    const [x1, y1] = path[k];
    const [x2, y2] = path[k + 1];
    if (y1 === y2 && y === y1 && x > Math.min(x1, x2) && x < Math.max(x1, x2)) return k;
    if (x1 === x2 && x === x1 && y > Math.min(y1, y2) && y < Math.max(y1, y2)) return k;
  }
  return undefined;
}

export function cellsOfPath(path: ReadonlyArray<readonly [number, number]>): Set<string> {
  const cells = new Set<string>();
  for (const [x, y] of pathCells(path)) cells.add(cellId(x, y));
  return cells;
}

export function cellsOf(re: RoutedEdge): Array<[number, number]> {
  return [...pathCells(re.drawPath)];
}

export function heldCells(routed: RoutedEdge[]): Map<string, RoutedEdge> {
  const held = new Map<string, RoutedEdge>();
  for (const re of routed) for (const [x, y] of cellsOf(re)) held.set(cellId(x, y), re);
  return held;
}

export function boxedAt(layout: GridLayout): (x: number, y: number) => boolean {
  return (x, y) => {
    for (const p of layout.placements.values()) {
      if (x >= p.drawX && x < p.drawX + p.drawWidth && y >= p.drawY && y < p.drawY + p.drawHeight) return true;
    }
    for (const sb of layout.subgraphBounds) {
      if (x >= sb.x && x < sb.x + sb.width && y >= sb.y && y < sb.y + sb.height) return true;
    }
    return false;
  };
}

export function riddenBy(marks: Marks, cell: string, index: number, alongRow: boolean): boolean {
  const foreign = (held: Set<number> | undefined): boolean => held !== undefined && [...held].some((one) => one !== index);
  if (foreign(marks.corners.get(cell)) || foreign(marks.ends.get(cell))) return true;
  const passing = marks.passes.get(cell);
  return passing !== undefined && [...passing].some(([one, along]) => one !== index && along === alongRow);
}

export function inRounds(
  routed: RoutedEdge[],
  layout: GridLayout,
  sgBounds: ReadonlyMap<string, SubgraphBounds>,
  round: (marks: Marks, solid: Set<string>) => boolean
): void {
  const solid = solidCells(layout, sgBounds);
  for (let n = 0; n < LIFT_ROUNDS; n++) if (!round(markPaths(routed), solid)) return;
}

export interface Endpoint {
  re: RoutedEdge;
  atEnd: boolean;
}
