import { MAX_SPREAD_STEP, MIN_APPROACH } from "../layout/grid.js";
import { type NodePlacement } from "../layout/laid.js";
import { AttachDir } from "../sides.js";
import { isSelfReference } from "../model.js";
import { type Endpoint } from "./routed.js";


function spreadOffset(i: number, n: number, step: number): number {
  const exact = (i - (n - 1) / 2) * step;
  return Math.sign(exact) * Math.ceil(Math.abs(exact));
}

function spreadSeats(n: number, step: number, min: number, max: number, at: number): number[] {
  const offsets = Array.from({ length: n }, (_, i) => spreadOffset(i, n, step));
  const wanted = (offsets[n - 1]) - (offsets[0]);
  const range = max - min;
  if (wanted <= range) {
    const start = Math.max(min, Math.min(max - wanted, at + (offsets[0])));
    return offsets.map((offset) => start + offset - (offsets[0]));
  }
  return Array.from({ length: n }, (_, i) => min + Math.round((i * range) / (n - 1)));
}

export function applySpread(
  endpoints: Endpoint[],
  point: [number, number],
  placement: NodePlacement,
  walls?: [number, number],
  shared = true,
  boxes: readonly NodePlacement[] = []
): void {
  if (placement.mark) return;
  const n = endpoints.length;
  const [px] = point;
  const first = endpoints[0];
  const attach = first.atEnd ? first.re.endDir : first.re.startDir;
  const at = (e: Endpoint): number => (e.atEnd ? e.re.drawPath.length - 1 : 0);
  const behind = (e: Endpoint): number => (e.atEnd ? e.re.drawPath.length - 2 : 1);

  const along = attach === AttachDir.TOP || attach === AttachDir.BOTTOM ? 0 : 1;
  const isLoop = (e: Endpoint): boolean => isSelfReference(e.re.edge);
  const comesFrom = (e: Endpoint): number => {
    const path = e.re.drawPath;
    const here = (path[at(e)])[along];
    const step = e.atEnd ? -1 : 1;
    for (let i = at(e) + step; i >= 0 && i < path.length; i += step) {
      const there = path[i][along];
      if (there !== here) return there;
    }
    return here;
  };
  // A loop leaves the lid for the corner it rounds: every run seated past its exit would cross it.
  const pastLoops = (e: Endpoint): number => (along === 0 && isLoop(e) ? 1 : 0);
  const ordered = [...endpoints].sort((a, b) => pastLoops(a) - pastLoops(b) || comesFrom(a) - comesFrom(b));

  const [min, max] =
    along === 0 ? [placement.drawX + 1, placement.drawX + placement.drawWidth - 2] : (walls ?? [placement.drawY + 1, placement.drawY + placement.drawHeight - 2]);
  const range = max - min;
  if (range < n - 1) return;
  if (along === 1) {
    const guarded = endpoints.filter((e) => !isLoop(e));
    const approach =
      guarded.length === 0
        ? MIN_APPROACH
        : Math.min(...guarded.map((e) => Math.abs(px - (e.re.drawPath[behind(e)])[0])));
    if (approach < MIN_APPROACH) return;
  }
  const here = point[along];
  const moved = (p: [number, number], seat: number): [number, number] => (along === 0 ? [seat, p[1]] : [p[0], seat]);
  // A box's seats share its side out evenly, each as far from the next as from the corners, never closer than they
  // stood. A frame's side is crossed by its members' own runs, so its seats keep to the tight step.
  const tight = Math.min(MAX_SPREAD_STEP, Math.floor(range / Math.max(n - 1, 1)));
  const across = 1 - along;
  // A seat moves its whole stem: shared out wider, it holds only where no stem then stands on or against another box.
  const clear = (seats: readonly number[]): boolean =>
    ordered.every((e, i) => {
      const adj = e.re.drawPath[behind(e)];
      if (seats[i] === here || adj[along] !== here) return true;
      const low = Math.min(point[across], adj[across]);
      const high = Math.max(point[across], adj[across]);
      return boxes.every((box) => {
        if (box.nodeId === e.re.edge.source || box.nodeId === e.re.edge.target) return true;
        const [start, size, from, length] = along === 0 ? [box.drawX, box.drawWidth, box.drawY, box.drawHeight] : [box.drawY, box.drawHeight, box.drawX, box.drawWidth];
        return seats[i] < start - 1 || seats[i] > start + size || high < from || low > from + length - 1;
      });
    });
  const wide = shared ? spreadSeats(n, Math.max(tight, Math.floor((range + 2) / (n + 1))), min, max, here) : undefined;
  const seats = wide !== undefined && clear(wide) ? wide : spreadSeats(n, tight, min, max, here);
  ordered.forEach((e, i) => {
    const seat = seats[i];
    const adj = e.re.drawPath[behind(e)];
    // A last leg running along the wall has no stem to slide: moving it would fold the path into a diagonal.
    if (seat === here || adj[along] !== here) return;
    e.re.drawPath[at(e)] = moved(point, seat);
    e.re.drawPath[behind(e)] = moved(adj, seat);
  });
}
