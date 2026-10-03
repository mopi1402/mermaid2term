import { type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { cellId } from "./pathfinder.js";
import { markPaths, solidCells, type RoutedEdge, inRounds } from "./routed.js";
import { retreatElbow } from "./elbows.js";

// A head's cell is inviolable: a line drawn across it leaves the reader unable to tell the head from a stub.
export function slideOffHeads(routed: RoutedEdge[], layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>): void {
  const headCells = (): Map<string, { owner: number; away: [number, number] }> => {
    const heads = new Map<string, { owner: number; away: [number, number] }>();
    routed.forEach((re, owner) => {
      const path = re.drawPath;
      if (path.length < 2) return;
      for (const [hasHead, border, inward] of [
        [re.edge.hasArrowEnd, path[path.length - 1], path[path.length - 2]],
        [re.edge.hasArrowStart, path[0], path[1]],
      ] satisfies Array<[boolean, [number, number], [number, number]]>) {
        if (!hasHead) continue;
        const away: [number, number] = [Math.sign(inward[0] - border[0]), Math.sign(inward[1] - border[1])];
        heads.set(cellId(border[0] + away[0], border[1] + away[1]), { owner, away });
      }
    });
    return heads;
  };
  inRounds(routed, layout, sgBounds, (marks, solid) => {
    const heads = headCells();
    let moved = false;
    routed.forEach((re, index) => {
      if (moved) return;
      const path = re.drawPath;
      for (let k = 1; k + 2 < path.length && !moved; k++) {
        const [ax, ay] = path[k];
        const [bx, by] = path[k + 1];
        const alongRow = ay === by;
        const from = alongRow ? ax : ay;
        const to = alongRow ? bx : by;
        const step = Math.sign(to - from);
        if (step === 0) continue;
        const cellOn = (lane: number, i: number): string => (alongRow ? cellId(i, lane) : cellId(lane, i));
        const at = alongRow ? ay : ax;
        let pierced: { owner: number; away: [number, number] } | undefined;
        for (let i = from + step; i !== to && pierced === undefined; i += step) {
          const head = heads.get(cellOn(at, i));
          if (head !== undefined && head.owner !== index) pierced = head;
        }
        if (pierced === undefined) continue;
        const preferred = alongRow ? pierced.away[1] : pierced.away[0];
        const before = path[k - 1];
        const after = path[k + 2];
        for (const offset of preferred === 0 ? [-1, 1] : [preferred, -preferred]) {
          const lane = at + offset;
          const beforeAt = alongRow ? before[1] : before[0];
          const afterAt = alongRow ? after[1] : after[0];
          if (Math.sign(lane - beforeAt) !== Math.sign(at - beforeAt) || Math.sign(lane - afterAt) !== Math.sign(at - afterAt)) continue;
          let clear = true;
          for (let i = from; i !== to + step && clear; i += step) {
            const cell = cellOn(lane, i);
            const isCorner = i === from || i === to;
            if (solid.has(cell) || heads.has(cell)) clear = false;
            else if ([marks.corners.get(cell), marks.ends.get(cell)].some((held) => held !== undefined && [...held].some((one) => one !== index))) clear = false;
            else {
              const passing = marks.passes.get(cell);
              if (passing !== undefined && [...passing].some(([one, along]) => one !== index && (isCorner || along === alongRow))) clear = false;
            }
          }
          if (!clear) continue;
          path[k] = alongRow ? [ax, lane] : [lane, ay];
          path[k + 1] = alongRow ? [bx, lane] : [lane, by];
          moved = true;
          break;
        }
      }
    });
    return moved;
  });
}

const HEAD_CELLS = 1;

export function airLabelsUp(routed: RoutedEdge[], layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>): void {
  if (!layout.padless) return;
  const solid = solidCells(layout, sgBounds);
  let marks = markPaths(routed);
  routed.forEach((re, index) => {
    if (re.label === "" || !re.edge.hasArrowEnd || re.drawPath.length < 4) return;
    const last = re.drawPath.length - 1;
    const border = re.drawPath[last];
    const corner = re.drawPath[last - 1];
    if (corner[0] !== border[0] || corner[1] >= border[1]) return;
    if (retreatElbow(re.drawPath, last, index, marks, solid, HEAD_CELLS + 1)) marks = markPaths(routed);
  });
}
