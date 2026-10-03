import { clamp } from "../../must.js";
import { Direction, isHorizontal, type Edge } from "../model.js";
import { STRIDE, midCol, midRow, type GridLayout } from "../layout/grid.js";
import { type NodePlacement } from "../layout/laid.js";
import { cellId, findPath, simplifyPath, type CellSet } from "./pathfinder.js";
import type { Point } from "../../canvas/cells.js";
import { AttachDir, determineDirections, gapBetweenIsClear, SELF_LOOP_SIDES } from "../sides.js";
import { type RoutedEdge } from "./routed.js";
import { type WallsOf } from "./spread.js";
import { LOOP_TURN, type LoopNest } from "../self-loops.js";

const ALONE: LoopNest = { rank: 0, count: 1, reach: 0 };

const PREFER_BIAS = 3;

const BEFORE_BIAS = 0.01;

function attachPoint(placement: NodePlacement, dir: AttachDir): Point {
  const { col, row } = placement.grid;
  if (dir === AttachDir.TOP) return [col, row - 1];
  if (dir === AttachDir.BOTTOM) return [col, row + 1];
  if (dir === AttachDir.LEFT) return [col - 1, row];
  return [col + 1, row];
}

const CRAMPED_HEAD = 20;

const CRAMPED_SEAT = 20;

function seatCapacity(node: NodePlacement, dir: AttachDir, walls?: [number, number]): number {
  if (walls !== undefined && (dir === AttachDir.LEFT || dir === AttachDir.RIGHT)) return Math.max(1, walls[1] - walls[0] + 1);
  if (node.mark) return 1;
  const span = dir === AttachDir.LEFT || dir === AttachDir.RIGHT ? node.drawHeight : node.drawWidth;
  return Math.max(1, span - 2);
}

export interface SeatCount {
  arrivals: number;
  hasDeparture: boolean;
}

function headRoom(cells: Point[], layout: GridLayout, atEnd: boolean, attach: AttachDir): number {
  const path = simplifyPath(cells);
  if (path.length < 3) return CRAMPED_HEAD;
  const border = (atEnd ? path[path.length - 1] : path[0]);
  const corner = (atEnd ? path[path.length - 2] : path[1]);
  const vertical = attach === AttachDir.TOP || attach === AttachDir.BOTTOM;
  if (vertical === (corner[1] === border[1])) return 1;
  const [ex, ey] = layout.laneToDraw(border[0], border[1]);
  const [cx, cy] = layout.laneToDraw(corner[0], corner[1]);
  return Math.abs(ex - cx) + Math.abs(ey - cy);
}

export function routeEdge(
  edge: Edge,
  src: NodePlacement,
  tgt: NodePlacement,
  layout: GridLayout,
  direction: Direction,
  softObstacles: CellSet,
  lanes: CellSet,
  hug: (col: number, row: number, alongRow: boolean) => number,
  seated: ReadonlyMap<string, SeatCount>,
  wallsOf: WallsOf = () => undefined
): RoutedEdge {
  const candidates = determineDirections(src, tgt, direction, gapBetweenIsClear(src, tgt, layout));
  const offer = (across: Array<[AttachDir, AttachDir]>): void => {
    for (const c of across) if (!candidates.some(([f, t]) => f === c[0] && t === c[1])) candidates.push(c);
  };
  if (tgt.mark) {
    offer(
      isHorizontal(direction)
        ? [[AttachDir.RIGHT, AttachDir.BOTTOM], [AttachDir.RIGHT, AttachDir.TOP]]
        : [[AttachDir.BOTTOM, AttachDir.RIGHT], [AttachDir.BOTTOM, AttachDir.LEFT]]
    );
  }
  if (src.mark) {
    offer(
      isHorizontal(direction)
        ? [[AttachDir.BOTTOM, AttachDir.LEFT], [AttachDir.TOP, AttachDir.LEFT]]
        : [[AttachDir.RIGHT, AttachDir.TOP], [AttachDir.LEFT, AttachDir.TOP]]
    );
  }
  const seatCost = (nodeId: string, node: NodePlacement, dir: AttachDir, isArrival: boolean): number => {
    const seat = seated.get(`${nodeId}:${dir}`);
    const arrivals = seat?.arrivals ?? 0;
    const hasDeparture = seat?.hasDeparture ?? false;
    const demand = isArrival ? arrivals + 1 + (hasDeparture ? 1 : 0) : hasDeparture ? 0 : arrivals + 1;
    return demand > seatCapacity(node, dir, wallsOf(nodeId)) ? CRAMPED_SEAT : 0;
  };
  // REAL room, not the least that passes: a run leaves the sized grid on purpose to round a box. At 0 eleven
  // invariants go red, at 1 two, at 2 none, so 2 is the edge and this sits well clear of it.
  const margin = 2 * STRIDE;
  let maxCol = 0;
  for (const c of layout.colWidths.keys()) if (c > maxCol) maxCol = c;
  let maxRow = 0;
  for (const r of layout.rowHeights.keys()) if (r > maxRow) maxRow = r;
  const free = (c: number, r: number): boolean =>
    c >= -margin && r >= -margin && c <= maxCol + margin && r <= maxRow + margin && (c < 0 || r < 0 || layout.isFree(c, r));

  // A run rounds the drawing on its left or over its top only where that is shorter: a tie keeps the side it has always
  // taken.
  const before = (c: number, r: number, alongRow: boolean): number => hug(c, r, alongRow) + (c < 0 || r < 0 ? BEFORE_BIAS : 0);
  const tried = candidates.map(([from, to], rank) => {
    const start = attachPoint(src, from);
    const end = attachPoint(tgt, to);
    const found = findPath(start[0], start[1], end[0], end[1], free, softObstacles, lanes, before);
    const margin = rank === 0 ? 0 : PREFER_BIAS;
    let cost = found === undefined ? Infinity : found.cost + margin;
    if (found !== undefined && edge.hasArrowEnd && headRoom(found.cells, layout, true, to) < 2) cost += CRAMPED_HEAD;
    if (found !== undefined && edge.hasArrowStart && headRoom(found.cells, layout, false, from) < 2) cost += CRAMPED_HEAD;
    if (found !== undefined) cost += seatCost(edge.source, src, from, false) + seatCost(edge.target, tgt, to, true);
    return { from, to, start, end, found, cost };
  });
  const best = tried.reduce((a, b) => (b.cost < a.cost ? b : a));
  const fallback = tried[0];

  const [path, startDir, endDir]: [Point[], AttachDir, AttachDir] =
    best.found === undefined
      ? [elbowOf(fallback.start, fallback.end, fallback.from, fallback.to), fallback.from, fallback.to]
      : [best.found.cells, best.from, best.to];

  const simplified = simplifyPath(path);
  const drawPath = simplified.map(([c, r]) => layout.laneToDraw(c, r));
  if (tgt.mark) snapToMark(drawPath, tgt, endDir, true);
  if (src.mark) snapToMark(drawPath, src, startDir, false);
  if (tgt.own && !tgt.mark) snapToBox(drawPath, tgt, endDir, true);
  if (src.own && !src.mark) snapToBox(drawPath, src, startDir, false);
  return {
    edge,
    gridPath: simplified,
    drawPath,
    startDir,
    endDir,
    label: edge.label,
    index: 0,
    occupiedCells: new Set(path.map(([c, r]) => cellId(c, r))),
  };
}

export function snapToMark(drawPath: Array<[number, number]>, placement: NodePlacement, dir: AttachDir, atEnd: boolean): void {
  if (drawPath.length < 2) return;
  const mx = midCol(placement);
  const my = midRow(placement);
  const end = atEnd ? drawPath.length - 1 : 0;
  const prev = atEnd ? drawPath.length - 2 : 1;
  const sideways = dir === AttachDir.LEFT || dir === AttachDir.RIGHT;
  const dx = dir === AttachDir.LEFT ? -1 : dir === AttachDir.RIGHT ? 1 : 0;
  const dy = dir === AttachDir.TOP ? -1 : dir === AttachDir.BOTTOM ? 1 : 0;
  drawPath[end] = [mx + dx, my + dy];
  const [px, py] = drawPath[prev];
  drawPath[prev] = sideways ? [px, my] : [mx, py];
}

function snapToBox(drawPath: Array<[number, number]>, placement: NodePlacement, dir: AttachDir, atEnd: boolean): void {
  if (drawPath.length < 2) return;
  const end = atEnd ? drawPath.length - 1 : 0;
  const prev = atEnd ? drawPath.length - 2 : 1;
  const [ex, ey] = drawPath[end];
  const left = placement.drawX;
  const right = placement.drawX + placement.drawWidth - 1;
  const top = placement.drawY;
  const bottom = placement.drawY + placement.drawHeight - 1;
  const sideways = dir === AttachDir.LEFT || dir === AttachDir.RIGHT;
  const snapped: [number, number] = sideways
    ? [dir === AttachDir.LEFT ? left : right, clamp(ey, top + 1, bottom - 1)]
    : [clamp(ex, left + 1, right - 1), dir === AttachDir.TOP ? top : bottom];
  drawPath[end] = snapped;
  const [px, py] = drawPath[prev];
  drawPath[prev] = sideways ? [px, snapped[1]] : [snapped[0], py];
}

// A box's loops nest as mermaid draws them: the first takes the box's corner, each next one leaves the lid two cells
// further in, rides one row higher, turns past the one before it and its label, and comes back one row lower.
export function routeSelfEdge(edge: Edge, src: NodePlacement, layout: GridLayout, horizontal: boolean, nest: LoopNest = ALONE): RoutedEdge {
  const { col, row } = src.grid;
  const path: Point[] = [
    [col, row - 1],
    [col, row - 2],
    [col + 2, row - 2],
    [col + 2, row],
    [col + 1, row],
  ];
  const drawPath = path.map(([c, r]) => layout.gridToDrawCenter(c, r));
  const borderX = src.drawX + src.drawWidth - 1;
  const exitX = Math.max(src.drawX + 1, Math.min(drawPath[0][0], borderX - 2));
  const gapWidth = layout.colWidths.get(col + 2) ?? 2;
  const turnX = horizontal
    ? Math.max(borderX + 2, Math.min(borderX + 3, borderX + gapWidth))
    : Math.max(drawPath[2][0], borderX + 2);
  drawPath[0][0] = exitX;
  drawPath[1][0] = exitX;
  drawPath[2][0] = turnX;
  drawPath[3][0] = turnX;
  drawPath[4] = [borderX, drawPath[4][1]];
  // Padless draws the lid on its cell's edge, so a loop riding the lid's row stands off it: it leaves the lid
  // upwards instead and rides the row over it, as a loop leaving a box lower down the page does.
  if (layout.padless && drawPath[1][1] >= src.drawY) {
    const out = Math.min(exitX, borderX - 2);
    drawPath[0] = [out, src.drawY];
    drawPath[1] = [out, src.drawY - 1];
    drawPath[2][1] = src.drawY - 1;
  }
  if (nest.count > 1) {
    const { rank } = nest;
    // Inside out: the first loop comes back highest on the wall, each next one a row under it, all of them over
    // the runs leaving that wall lower down, and the nest keeps to the lid's far end, clear of the runs arriving on
    // its middle. The layout gave the box a lid cell and a wall row for each.
    const back = Math.min(src.drawY + src.drawHeight - 2, src.drawY + 1 + rank);
    const out = Math.max(src.drawX + 1, borderX - 2 - 2 * rank);
    const top = Math.max(drawPath[1][1], src.drawY - 1) - rank;
    // Down the page the first turn keeps the cell a lone loop's takes, whatever room the nest widened the gap to.
    const turn = (horizontal ? turnX : Math.min(turnX, borderX + LOOP_TURN)) + nest.reach;
    drawPath.splice(0, drawPath.length, [out, drawPath[0][1]], [out, top], [turn, top], [turn, back], [borderX, back]);
  }
  return {
    edge,
    gridPath: path,
    drawPath,
    startDir: SELF_LOOP_SIDES[0],
    endDir: SELF_LOOP_SIDES[1],
    label: edge.label,
    index: 0,
    occupiedCells: new Set(path.map(([c, r]) => cellId(c, r))),
  };
}

const upright = (dir: AttachDir): boolean => dir === AttachDir.TOP || dir === AttachDir.BOTTOM;

// The run laid where no path was found, leaving and reaching along the sides it attaches to: one turn when they
// cross, two about the middle when they are parallel. Every later pass reads a path as runs along one axis each,
// so even this one is never drawn across a diagonal.
function elbowOf(start: Point, end: Point, from: AttachDir, to: AttachDir): Point[] {
  if (upright(from) !== upright(to)) return [start, upright(from) ? [start[0], end[1]] : [end[0], start[1]], end];
  if (upright(from)) {
    const row = Math.round((start[1] + end[1]) / 2);
    return [start, [start[0], row], [end[0], row], end];
  }
  const col = Math.round((start[0] + end[0]) / 2);
  return [start, [col, start[1]], [col, end[1]], end];
}
