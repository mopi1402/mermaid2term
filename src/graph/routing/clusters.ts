import { midCol, midRow, type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { cellId } from "./pathfinder.js";
import { cellsOfPath, inRounds, markPaths, solidCells, type RoutedEdge, riddenBy } from "./routed.js";
import { type WallsOf } from "./spread.js";

// The cells across a box or a frame a run meeting it may stand on, rows for a run along a row.
export function spanOf(
  layout: GridLayout,
  sgBounds: ReadonlyMap<string, SubgraphBounds>,
  wallsOf: WallsOf,
  id: string,
  along: boolean
): [number, number] | undefined {
  const sb = sgBounds.get(id);
  if (sb !== undefined) return along ? [sb.y + 1, sb.y + sb.height - 2] : [sb.x + 1, sb.x + sb.width - 2];
  const p = layout.placements.get(id);
  if (p === undefined) return undefined;
  // A mark is one glyph, not the box it is seated in: a run parted off its centre leaves it from an empty cell.
  if (p.mark) {
    const centre = along ? midRow(p) : midCol(p);
    return [centre, centre];
  }
  const walls = along ? wallsOf(id) : undefined;
  if (walls !== undefined) return walls;
  return along ? [p.drawY + 1, p.drawY + p.drawHeight - 2] : [p.drawX + 1, p.drawX + p.drawWidth - 2];
}

export function partClusterRuns(
  routed: RoutedEdge[],
  layout: GridLayout,
  sgBounds: ReadonlyMap<string, SubgraphBounds>,
  wallsOf: WallsOf = () => undefined
): void {
  const solid = solidCells(layout, sgBounds);
  routed.forEach((re, index) => {
    if (!(re.edge.sourceIsSubgraph || re.edge.targetIsSubgraph) || re.drawPath.length !== 2) return;
    const [[ax, ay], [bx, by]] = re.drawPath;
    const along = ay === by;
    if (!along && ax !== bx) return;
    const marks = markPaths(routed);
    const ridden = (cell: string): boolean => riddenBy(marks, cell, index, along);
    const shared = [...cellsOfPath(re.drawPath)].some((cell) => ridden(cell));
    const source = spanOf(layout, sgBounds, wallsOf, re.edge.source, along);
    const target = spanOf(layout, sgBounds, wallsOf, re.edge.target, along);
    if (source === undefined || target === undefined) return;
    const low = Math.max(source[0], target[0]);
    const high = Math.min(source[1], target[1]);
    const at = along ? ay : ax;
    const from = Math.min(along ? ax : ay, along ? bx : by);
    const to = Math.max(along ? ax : ay, along ? bx : by);
    const cellOn = (lane: number, i: number): string => (along ? cellId(i, lane) : cellId(lane, i));
    const crossed = new Set<number>();
    for (let i = from + 1; i < to; i++) if (solid.has(cellOn(at, i))) crossed.add(i);
    const clear = (lane: number): boolean => {
      for (let i = from; i <= to; i++) {
        const cell = cellOn(lane, i);
        if (ridden(cell) || (i !== from && i !== to && !crossed.has(i) && solid.has(cell))) return false;
      }
      return true;
    };
    const aired = (lane: number): boolean => {
      for (const side of [lane - 1, lane + 1]) {
        for (let i = from; i <= to; i++) if (ridden(cellOn(side, i))) return false;
      }
      return true;
    };
    // A run of its own moves only off a run it stands against, where a lane clear of every other is open.
    if (!shared && aired(at)) return;
    const lanes: number[] = [];
    for (let k = 1; at - k >= low || at + k <= high; k++) {
      if (at - k >= low) lanes.push(at - k);
      if (at + k <= high) lanes.push(at + k);
    }
    const crossings = (lane: number): number => {
      let n = 0;
      for (let i = from + 1; i < to; i++) {
        const passing = marks.passes.get(cellOn(lane, i));
        if (passing !== undefined && [...passing].some(([one, alongRow]) => one !== index && alongRow !== along)) n++;
      }
      return n;
    };
    const lane = shared
      ? (lanes.find((l) => clear(l) && aired(l) && crossings(l) === 0) ?? lanes.find((l) => clear(l) && aired(l)) ?? lanes.find(clear))
      : lanes.find((l) => clear(l) && aired(l) && crossings(l) === 0);
    if (lane === undefined) return;
    re.drawPath = along ? [[ax, lane], [bx, lane]] : [[lane, ay], [lane, by]];
  });
}

export function slideClusterEnds(routed: RoutedEdge[], layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>): void {
  const solid = solidCells(layout, sgBounds);
  // Read again only where the round before MOVED something. Read per edge it was rebuilt whether or not the edge
  // could move, and that one site was 85% of every `markPaths` call. A round still sees every earlier move.
  let marks = markPaths(routed);
  let slid = false;
  routed.forEach((re, index) => {
    if (slid) {
      marks = markPaths(routed);
      slid = false;
    }
    const ridden = (cell: string, alongRow: boolean): boolean => riddenBy(marks, cell, index, alongRow);
    const path = re.drawPath;
    if (path.length < 3) return;
    for (const atEnd of [true, false]) {
      const id = atEnd ? re.edge.target : re.edge.source;
      const sb = (atEnd ? re.edge.targetIsSubgraph : re.edge.sourceIsSubgraph) ? sgBounds.get(id) : undefined;
      if (sb === undefined) continue;
      const end = (atEnd ? path[path.length - 1] : path[0]);
      const corner = (atEnd ? path[path.length - 2] : path[1]);
      const feed = (atEnd ? path[path.length - 3] : path[2]);
      const alongRow = corner[1] === end[1];
      if (alongRow ? corner[0] === end[0] || feed[0] !== corner[0] : corner[1] === end[1] || feed[1] !== corner[1]) continue;
      const onWall = alongRow ? end[0] === sb.x || end[0] === sb.x + sb.width - 1 : end[1] === sb.y || end[1] === sb.y + sb.height - 1;
      if (!onWall) continue;
      const legCells = (lane: number): string[] => {
        const cells: string[] = [];
        const from = alongRow ? corner[0] : corner[1];
        const to = alongRow ? end[0] : end[1];
        const step = Math.sign(to - from);
        for (let i = from; i !== to; i += step) cells.push(alongRow ? cellId(i, lane) : cellId(lane, i));
        return cells;
      };
      const at = alongRow ? corner[1] : corner[0];
      if (!legCells(at).some((cell) => ridden(cell, alongRow))) continue;
      const low = alongRow ? sb.y + 1 : sb.x + 1;
      const high = alongRow ? sb.y + sb.height - 2 : sb.x + sb.width - 2;
      const feedAt = alongRow ? feed[1] : feed[0];
      const clear = (lane: number): boolean => {
        if (legCells(lane).some((cell) => ridden(cell, alongRow) || solid.has(cell))) return false;
        const step = Math.sign(lane - feedAt);
        for (let i = feedAt + step; step !== 0 && i !== lane + step; i += step) {
          const cell = alongRow ? cellId(corner[0], i) : cellId(i, corner[1]);
          if (ridden(cell, !alongRow) || solid.has(cell)) return false;
        }
        return true;
      };
      for (let k = 1; at - k >= low || at + k <= high; k++) {
        const lane = [at - k, at + k].find((l) => l >= low && l <= high && clear(l));
        if (lane === undefined) continue;
        const moved: [number, number] = alongRow ? [corner[0], lane] : [lane, corner[1]];
        const landed: [number, number] = alongRow ? [end[0], lane] : [lane, end[1]];
        if (atEnd) {
          path[path.length - 2] = moved;
          path[path.length - 1] = landed;
        } else {
          path[1] = moved;
          path[0] = landed;
        }
        if (moved[0] === feed[0] && moved[1] === feed[1]) path.splice(atEnd ? path.length - 2 : 1, 1);
        slid = true;
        break;
      }
    }
  });
}

const HEADED_LEG = 3;
const BARE_LEG = 2;
const SLACK_CELLS = 2;

// A run laid one cell beside a frame's wall steps one cell further off it, where that lane and its far side are free.
export function airRunsOffWalls(routed: RoutedEdge[], layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>): void {
  const frames = [...sgBounds.values()].filter((sb) => sb.width > 0 && sb.height > 0);
  inRounds(routed, layout, sgBounds, (marks, solid) => {
    let moved = false;
    routed.forEach((re, index) => {
      const path = re.drawPath;
      for (let k = 1; !moved && k + 2 < path.length; k++) {
        const [a, b] = [path[k], path[k + 1]];
        const vertical = a[0] === b[0];
        if (vertical === (a[1] === b[1])) continue;
        const across = vertical ? 0 : 1;
        const along = vertical ? 1 : 0;
        const at = a[across];
        const from = Math.min(a[along], b[along]);
        const to = Math.max(a[along], b[along]);
        const cell = (lane: number, i: number): string => (vertical ? cellId(lane, i) : cellId(i, lane));
        const hugs = (side: number): boolean =>
          frames.some((sb) => {
            const [start, size, low, length] = vertical ? [sb.x, sb.width, sb.y, sb.height] : [sb.y, sb.height, sb.x, sb.width];
            const wall = side > 0 ? start : start + size - 1;
            return (wall === at + side || (layout.padless && wall === at)) && Math.min(to - 1, low + length - 1) - Math.max(from + 1, low) >= 1;
          });
        for (const side of [1, -1]) {
          const lane = at - side;
          // A leg ending on a box keeps the corner, shaft and head it needs.
          const kept = (feed: number, end: boolean, head: boolean): boolean => {
            const leg = Math.abs(path[feed][across] - lane);
            return end ? leg > Math.abs(path[feed][across] - at) || leg >= (head ? HEADED_LEG : BARE_LEG) : leg > 0;
          };
          const last = k + 3 === path.length;
          if (!hugs(side) || !kept(k - 1, k === 1, re.edge.hasArrowStart) || !kept(k + 2, last, re.edge.hasArrowEnd)) continue;
          const free = (i: number): boolean => {
            const crossed = solid.has(cell(at, i));
            const target = cell(lane, i);
            const passing = marks.passes.get(cell(at, i));
            const foreign = [...(marks.passes.get(target) ?? [])].some(
              ([one, alongRow]) => one !== index && alongRow === vertical && passing?.get(one) !== vertical
            );
            if (riddenBy(marks, target, index, !vertical) || foreign) return false;
            return crossed || !(solid.has(target) || solid.has(cell(lane - side, i)) || riddenBy(marks, cell(lane - side, i), index, !vertical));
          };
          // Past a wide stretch the step costs a cell the canvas compacts away, and the run hugs the wall again.
          const clearAt = (beyond: number): boolean => {
            for (let i = from; i <= to; i++) {
              if (!solid.has(cell(at, i)) && (solid.has(cell(beyond, i)) || riddenBy(marks, cell(beyond, i), index, !vertical))) return false;
            }
            return true;
          };
          // Past the drawing's edge nothing is compacted: the step there always holds.
          const inside = (beyond: number): boolean => beyond >= 0 && beyond < (vertical ? layout.canvasWidth : layout.canvasHeight);
          let slack = 0;
          while (slack < SLACK_CELLS && inside(lane - (slack + 2) * side) && clearAt(lane - (slack + 2) * side)) slack++;
          let open = slack < SLACK_CELLS;
          for (let i = from; open && i <= to; i++) open = free(i);
          if (!open) continue;
          path[k] = vertical ? [lane, a[1]] : [a[0], lane];
          path[k + 1] = vertical ? [lane, b[1]] : [b[0], lane];
          moved = true;
          break;
        }
      }
    });
    return moved;
  });
}
