import { cellId } from "../../canvas/geometry.js";
import { must } from "../../must.js";
import type { Point } from "../../canvas/cells.js";

// All the search asks of a set of cells is whether one is in it, which a RULE answers as well as a `Set`.
// Building the sets walked every lane and every soft obstacle per edge, which was quadratic in the edge count.
export interface CellSet {
  has(key: string): boolean;
}

export const NO_CELLS: CellSet = { has: () => false };

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

const STEP_COST = 1;
const SOFT_PENALTY = 2;
const CORNER_PENALTY = 0.5;
const MERGE_PENALTY = 6;
export const HUG_BIAS = 0.001;
const ALONG_ROW = "h";
const ALONG_COL = "v";
export const laneId = (col: number, row: number, alongRow: boolean): string =>
  `${alongRow ? ALONG_ROW : ALONG_COL}:${col},${row}`;
const HEURISTIC_CORNER = 1;
const MAX_ITERATIONS = 5000;

export { cellId };

interface AStarNode {
  fCost: number;
  gCost: number;
  col: number;
  row: number;
  parent: AStarNode | undefined;
}

const less = (a: AStarNode, b: AStarNode): boolean => a.fCost < b.fCost;

function siftDown(heap: AStarNode[], startPos: number, pos: number): void {
  const newItem = heap[pos];
  while (pos > startPos) {
    const parentPos = (pos - 1) >> 1;
    const parent = heap[parentPos];
    if (!less(newItem, parent)) break;
    heap[pos] = parent;
    pos = parentPos;
  }
  heap[pos] = newItem;
}

function siftUp(heap: AStarNode[], pos: number): void {
  const endPos = heap.length;
  const startPos = pos;
  const newItem = heap[pos];
  let childPos = 2 * pos + 1;
  while (childPos < endPos) {
    const rightPos = childPos + 1;
    if (rightPos < endPos && !less(heap[childPos], heap[rightPos])) childPos = rightPos;
    heap[pos] = heap[childPos];
    pos = childPos;
    childPos = 2 * pos + 1;
  }
  heap[pos] = newItem;
  siftDown(heap, startPos, pos);
}

function heapPush(heap: AStarNode[], item: AStarNode): void {
  heap.push(item);
  siftDown(heap, 0, heap.length - 1);
}

function heapPop(heap: AStarNode[]): AStarNode {
  const last = must(heap.pop());
  if (heap.length === 0) return last;
  const top = heap[0];
  heap[0] = last;
  siftUp(heap, 0);
  return top;
}

function heuristic(c1: number, r1: number, c2: number, r2: number): number {
  const dx = Math.abs(c1 - c2);
  const dy = Math.abs(r1 - r2);
  return dx === 0 || dy === 0 ? dx + dy : dx + dy + HEURISTIC_CORNER;
}

function reconstruct(node: AStarNode): Point[] {
  const path: Point[] = [];
  let current: AStarNode | undefined = node;
  while (current !== undefined) {
    path.push([current.col, current.row]);
    current = current.parent;
  }
  path.reverse();
  return path;
}

interface FoundPath {
  cells: Point[];
  cost: number;
}

export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  isFree: (col: number, row: number) => boolean,
  softObstacles: CellSet = new Set<string>(),
  lanes: CellSet = new Set<string>(),
  hug: (col: number, row: number, alongRow: boolean) => number = () => 0,
  maxIterations: number = MAX_ITERATIONS
): FoundPath | undefined {
  if (startCol === endCol && startRow === endRow) return { cells: [[startCol, startRow]], cost: 0 };

  const start: AStarNode = {
    fCost: heuristic(startCol, startRow, endCol, endRow),
    gCost: 0,
    col: startCol,
    row: startRow,
    parent: undefined,
  };

  const open: AStarNode[] = [start];
  const closed = new Set<string>();
  const bestG = new Map<string, number>([[cellId(startCol, startRow), 0]]);

  for (let iterations = 0; open.length > 0 && iterations < maxIterations; iterations++) {
    const current = heapPop(open);
    if (current.col === endCol && current.row === endRow) return { cells: reconstruct(current), cost: current.gCost };

    const key = cellId(current.col, current.row);
    if (closed.has(key)) continue;
    closed.add(key);

    for (const [dc, dr] of DIRS) {
      const col = current.col + dc;
      const row = current.row + dr;
      const next = cellId(col, row);
      if (closed.has(next)) continue;

      const isEndpoint = col === endCol && row === endRow;
      if (!isEndpoint && !isFree(col, row)) continue;

      let stepCost = STEP_COST;
      if (softObstacles.has(next)) stepCost += SOFT_PENALTY;
      if (lanes.has(laneId(col, row, dr === 0))) stepCost += MERGE_PENALTY;
      stepCost += hug(col, row, dr === 0);
      if (current.parent !== undefined) {
        const prevDc = current.col - current.parent.col;
        const prevDr = current.row - current.parent.row;
        if (dc !== prevDc || dr !== prevDr) stepCost += CORNER_PENALTY;
      }

      const g = current.gCost + stepCost;
      const known = bestG.get(next);
      if (known !== undefined && known <= g) continue;
      bestG.set(next, g);

      heapPush(open, { fCost: g + heuristic(col, row, endCol, endRow), gCost: g, col, row, parent: current });
    }
  }

  return undefined;
}

export function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path;
  const result: Point[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const current = path[i];
    const next = path[i + 1];
    const turned = current[0] - prev[0] !== next[0] - current[0] || current[1] - prev[1] !== next[1] - current[1];
    if (turned) result.push(current);
  }
  result.push(path[path.length - 1]);
  return result;
}
