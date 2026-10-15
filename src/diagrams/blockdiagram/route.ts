import { cellId, pathCells } from "../../canvas/geometry.js";
import { findPath, laneId, simplifyPath } from "../../graph/routing/pathfinder.js";
import type { Canvas } from "../../canvas/canvas.js";
import { edgesOf, ringCells } from "../../canvas/extent.js";
import type { Point } from "../../canvas/cells.js";
import type { Block, BlockLink } from "./model.js";
import { sizeOf, type Placed, type Sized } from "./metrics.js";

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// What the links drawn so far and the blocks leave to the next link: the cells it may not take and those it pays for.
export interface Board {
  readonly leaves: readonly Rect[];
  readonly frames: Set<string>;
  readonly lanes: Set<string>;
  readonly lines: Set<string>;
  readonly heads: Set<string>;
}

// A link's way: its corners from the cell beside the source to the one beside the target, and where each head points.
export interface Route {
  readonly corners: readonly Point[];
  readonly startHead: Point;
  readonly endHead: Point;
  readonly direct: boolean;
}

export function boardOf(blocks: readonly Block[], positions: Placed, sizes: Sized): Board {
  const board: Board = { leaves: [], frames: new Set(), lanes: new Set(), lines: new Set(), heads: new Set() };
  const leaves: Rect[] = [];
  const walk = (level: readonly Block[]): void => {
    for (const block of level) {
      const at = positions.get(block.id);
      if (block.isSpace || at === undefined) continue;
      const [w, h] = sizeOf(sizes, block.id);
      const rect = { x: at[0], y: at[1], w, h };
      if (block.children.length === 0) {
        leaves.push(rect);
        continue;
      }
      const edges = edgesOf(rect);
      for (const [r, c] of ringCells(edges)) {
        board.frames.add(cellId(c, r));
        board.lanes.add(laneId(c, r, r === edges.top || r === edges.bottom));
      }
      walk(block.children);
    }
  };
  walk(blocks);
  return { ...board, leaves };
}

export const inside = ({ x, y, w, h }: Rect, col: number, row: number): boolean => col >= x && col < x + w && row >= y && row < y + h;

// A cell a line may not take: inside a block, under a head already drawn, or off the canvas.
function taken(board: Board, canvas: Canvas, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= canvas.width || row >= canvas.height) return true;
  return board.heads.has(cellId(col, row)) || board.leaves.some((rect) => inside(rect, col, row));
}

// The straight way between two facing walls, the source's middle facing the target; any other link takes a detour.
function directRoute(source: Rect, target: Rect): Route | undefined {
  const { x: sx, y: sy, w: sw, h: sh } = source;
  const { x: tx, y: ty, w: tw, h: th } = target;
  const sourceMidCol = sx + Math.floor(sw / 2);
  const sourceMidRow = sy + Math.floor(sh / 2);
  const targetMidRow = ty + Math.floor(th / 2);

  if (sourceMidCol >= tx && sourceMidCol < tx + tw && (ty >= sy + sh || ty + th <= sy)) {
    const dy = targetMidRow > sourceMidRow ? 1 : -1;
    const r1 = dy > 0 ? sy + sh : sy - 1;
    const r2 = dy > 0 ? ty - 1 : ty + th;
    return { corners: distinct([[sourceMidCol, r1], [sourceMidCol, r2]]), startHead: [0, -dy], endHead: [0, dy], direct: true };
  }
  if (sourceMidRow !== targetMidRow || (tx < sx + sw && tx + tw > sx)) return undefined;
  const dx = tx > sx ? 1 : -1;
  const c1 = dx > 0 ? sx + sw : sx - 1;
  const c2 = dx > 0 ? tx - 1 : tx + tw;
  return { corners: distinct([[c1, sourceMidRow], [c2, sourceMidRow]]), startHead: [-dx, 0], endHead: [dx, 0], direct: true };
}

export const cellsOf = (corners: readonly Point[]): Point[] => (corners.length === 1 ? [...corners] : [...pathCells(corners)]);

const distinct = (points: readonly Point[]): Point[] =>
  points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);

// The cell beside each wall's middle, with the step that leads away from the wall.
function doors({ x, y, w, h }: Rect): Array<readonly [Point, Point]> {
  const midCol = x + Math.floor(w / 2);
  const midRow = y + Math.floor(h / 2);
  return [
    [[x + w, midRow], [1, 0]],
    [[x - 1, midRow], [-1, 0]],
    [[midCol, y + h], [0, 1]],
    [[midCol, y - 1], [0, -1]],
  ];
}

// A turn costs a few steps, so a detour takes one wide sweep round the blocks over a zigzag through the gaps; a turn
// on the cell beside a wall costs more, most of all under the head, which then points off the line it ends.
const TURN_COST = 6;
const START_TURN_COST = 2;
const END_TURN_COST = 8;
// A run along a block's wall, on the cell beside it, pays a little, so a detour keeps to the margins over the gaps
// the straight links run through; a run along another line or a frame's wall is all but barred.
const HUG_COST = 0.25;
const ALONG_COST = 1000;

const hugs = (board: Board, col: number, row: number, alongRow: boolean): boolean =>
  board.leaves.some(({ x, y, w, h }) =>
    alongRow ? col >= x && col < x + w && (row === y - 1 || row === y + h) : row >= y && row < y + h && (col === x - 1 || col === x + w)
  );

const same = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1];

// The cheapest way round the blocks and the heads between two walls, each end leaving its wall square.
function detour(board: Board, canvas: Canvas, source: Rect, target: Rect): Route | undefined {
  const free = (col: number, row: number): boolean => !taken(board, canvas, col, row) && !canvas.isText(row, col);
  const door = ([col, row]: Point): boolean => free(col, row) && !board.lines.has(cellId(col, row));
  const soft = { has: (key: string): boolean => board.frames.has(key) || board.lines.has(key) };
  let best: { route: Route; cost: number } | undefined;
  for (const [start, out] of doors(source)) {
    if (!door(start)) continue;
    const inner: Point = [start[0] - out[0], start[1] - out[1]];
    for (const [end, back] of doors(target)) {
      if (!door(end) || same(start, end)) continue;
      const beyond: Point = [end[0] - back[0], end[1] - back[1]];
      // Searched from inside one block to inside the other, so a turn on the cell beside a wall counts as one.
      const turning = (col: number, row: number, alongRow: boolean): number =>
        (same([col, row], end) && alongRow !== (back[1] === 0) ? END_TURN_COST : 0) +
        (Math.abs(col - start[0]) + Math.abs(row - start[1]) === 1 && alongRow !== (out[1] === 0) ? START_TURN_COST : 0) +
        (hugs(board, col, row, alongRow) ? HUG_COST : 0) +
        (board.lanes.has(laneId(col, row, alongRow)) ? ALONG_COST : 0);
      const found = findPath(inner[0], inner[1], beyond[0], beyond[1], free, soft, board.lanes, turning, canvas.width * canvas.height * 4);
      if (found === undefined || found.cells.length < 3) continue;
      const turns = simplifyPath(found.cells);
      const cost = found.cost + TURN_COST * (turns.length - 2);
      if (best !== undefined && best.cost <= cost) continue;
      const cells = found.cells.slice(1, -1);
      best = { route: { corners: simplifyPath(cells), startHead: [-out[0], -out[1]], endHead: [-back[0], -back[1]], direct: false }, cost };
    }
  }
  return best?.route;
}

// No block and no head on the way, and no line under either end.
function clear(board: Board, canvas: Canvas, route: Route): boolean {
  const cells = cellsOf(route.corners);
  const ends = [cells[0], cells[cells.length - 1]];
  return cells.every(([col, row]) => !taken(board, canvas, col, row)) && ends.every(([col, row]) => !board.lines.has(cellId(col, row)));
}

// The direct way when nothing stands on it and no line holds its ends; else, once every direct way is drawn, a detour.
export function routeLink(board: Board, canvas: Canvas, link: BlockLink, positions: Placed, sizes: Sized, late: boolean): Route | undefined {
  const rectOf = (id: string): Rect | undefined => {
    const at = positions.get(id);
    if (at === undefined) return undefined;
    const [w, h] = sizeOf(sizes, id);
    return { x: at[0], y: at[1], w, h };
  };
  const source = rectOf(link.source);
  const target = rectOf(link.target);
  if (source === undefined || target === undefined) return undefined;
  const direct = directRoute(source, target);
  if (direct !== undefined && clear(board, canvas, direct)) return direct;
  if (!late) return undefined;
  return detour(board, canvas, source, target) ?? direct;
}
