import { type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { type Edge } from "../model.js";
import { spanOf } from "./clusters.js";
import { tidyDrawPath } from "./elbows.js";
import { solidCells, type RoutedEdge } from "./routed.js";
import { notWorse, tally, type Tally } from "./tally.js";
import { type WallsOf } from "./spread.js";

type Path = Array<[number, number]>;

const ROUNDS = 8;

interface Wall {
  index: number;
  atEnd: boolean;
  id: string;
  alongRow: boolean;
  line: number;
  seat: number;
  low: number;
  high: number;
}

const endsOn = (edge: Edge, id: string): boolean =>
  (edge.sourceIsSubgraph && edge.source === id) || (edge.targetIsSubgraph && edge.target === id);

function wallsOf(routed: readonly RoutedEdge[], sgBounds: ReadonlyMap<string, SubgraphBounds>): Wall[] {
  const walls: Wall[] = [];
  routed.forEach((re, index) => {
    const path = re.drawPath;
    if (path.length < 2) return;
    for (const atEnd of [false, true]) {
      const id = atEnd ? re.edge.target : re.edge.source;
      const sb = (atEnd ? re.edge.targetIsSubgraph : re.edge.sourceIsSubgraph) ? sgBounds.get(id) : undefined;
      if (sb === undefined) continue;
      const end = atEnd ? path[path.length - 1] : path[0];
      const next = atEnd ? path[path.length - 2] : path[1];
      const alongRow = end[1] === next[1];
      if (alongRow === (end[0] === next[0])) continue;
      const [line, seat, low, high] = alongRow ? [end[0], end[1], sb.y, sb.y + sb.height - 1] : [end[1], end[0], sb.x, sb.x + sb.width - 1];
      walls.push({ index, atEnd, id, alongRow, line, seat, low, high });
    }
  });
  return walls;
}

// The runs a frame's members send through the wall a link meets it on, each by the link and the seat it crosses at.
function seatsThrough(routed: readonly RoutedEdge[], wall: Wall): Array<[number, number]> {
  const seats: Array<[number, number]> = [];
  routed.forEach((re, index) => {
    if (index === wall.index || endsOn(re.edge, wall.id)) return;
    const path = re.drawPath;
    for (let k = 0; k + 1 < path.length; k++) {
      const [a, b] = [path[k], path[k + 1]];
      if (wall.alongRow ? a[1] !== b[1] || a[0] === b[0] : a[0] !== b[0] || a[1] === b[1]) continue;
      const [from, to, at] = wall.alongRow ? [a[0], b[0], a[1]] : [a[1], b[1], a[0]];
      if (Math.min(from, to) <= wall.line && Math.max(from, to) >= wall.line && at > wall.low && at < wall.high) seats.push([index, at]);
    }
  });
  return seats;
}

const wedged = (routed: readonly RoutedEdge[], wall: Wall): boolean => {
  const seats = seatsThrough(routed, wall).map(([, at]) => at);
  return seats.some((at) => at < wall.seat) && seats.some((at) => at > wall.seat);
};

const wedgedCount = (routed: readonly RoutedEdge[], sgBounds: ReadonlyMap<string, SubgraphBounds>): number =>
  wallsOf(routed, sgBounds).filter((w) => wedged(routed, w)).length;

const better = (after: Tally, before: Tally, wedgedAfter: number, wedgedBefore: number): boolean =>
  wedgedAfter < wedgedBefore && notWorse(after, before);

// The end leg moved onto another seat, its corner sliding along the run that feeds it, never turning that run back.
function slid(path: Path, atEnd: boolean, alongRow: boolean, lane: number): Path | undefined {
  const axis = alongRow ? 1 : 0;
  const out: Path = path.map((p): [number, number] => [p[0], p[1]]);
  if (out.length === 2) {
    out[0][axis] = lane;
    out[1][axis] = lane;
    return out;
  }
  const [e, c, f] = atEnd ? [out.length - 1, out.length - 2, out.length - 3] : [0, 1, 2];
  const feed = out[c][axis] - out[f][axis];
  if (feed !== 0 && Math.sign(lane - out[f][axis]) === -Math.sign(feed)) return undefined;
  out[e][axis] = lane;
  out[c][axis] = lane;
  return tidyDrawPath(out);
}

// A link to a frame meets its wall past every run the frame's members send through it, on the side it heads to,
// where it gets there crossing, riding and hugging no more than it did. A run of the members' in the way trades seats.
export function seatFrameLinksOutside(
  routed: RoutedEdge[],
  layout: GridLayout,
  sgBounds: ReadonlyMap<string, SubgraphBounds>,
  wallsOfNode: WallsOf = () => undefined
): void {
  const solid = solidCells(layout, sgBounds);
  const fits = (re: RoutedEdge, path: Path): boolean =>
    [false, true].every((atEnd) => {
      const end = atEnd ? path[path.length - 1] : path[0];
      const next = atEnd ? path[path.length - 2] : path[1];
      const alongRow = end[1] === next[1];
      const span = spanOf(layout, sgBounds, wallsOfNode, atEnd ? re.edge.target : re.edge.source, alongRow);
      const seat = alongRow ? end[1] : end[0];
      return span !== undefined && seat >= span[0] && seat <= span[1];
    });
  for (let round = 0; round < ROUNDS; round++) {
    const before = tally(routed, solid);
    const wedgedBefore = wedgedCount(routed, sgBounds);
    if (wedgedBefore === 0) return;
    const moved = wallsOf(routed, sgBounds).some((wall) => {
      const re = routed[wall.index];
      if (re.label !== "" || !wedged(routed, wall)) return false;
      const seats = seatsThrough(routed, wall);
      const far = (re.drawPath[wall.atEnd ? 0 : re.drawPath.length - 1])[wall.alongRow ? 1 : 0];
      const sides = far < wall.seat ? [-1, 1] : [1, -1];
      const tried = (paths: ReadonlyMap<number, Path>): boolean => {
        if ([...paths].some(([i, path]) => !fits(routed[i], path))) return false;
        const kept = new Map([...paths.keys()].map((i) => [i, routed[i].drawPath]));
        for (const [i, path] of paths) routed[i].drawPath = path;
        if (better(tally(routed, solid), before, wedgedCount(routed, sgBounds), wedgedBefore)) return true;
        for (const [i, path] of kept) routed[i].drawPath = path;
        return false;
      };
      return sides.some((side) => {
        const beyond = seats.filter(([, at]) => (at - wall.seat) * side > 0).sort(([, a], [, b]) => (a - b) * side);
        const last = beyond[beyond.length - 1];
        if (last === undefined) return false;
        const outer = side > 0 ? wall.high - 2 : wall.low + 2;
        for (let lane = outer; (lane - last[1]) * side > 0; lane -= side) {
          const path = slid(re.drawPath, wall.atEnd, wall.alongRow, lane);
          if (path !== undefined && tried(new Map([[wall.index, path]]))) return true;
        }
        // The members' runs it stands behind each step back one seat, and it takes the last of them.
        const traded = new Map<number, Path>();
        const own = slid(re.drawPath, wall.atEnd, wall.alongRow, last[1]);
        if (own === undefined) return false;
        traded.set(wall.index, own);
        for (const [k, [i, at]] of beyond.entries()) {
          const other = routed[i];
          if (other.drawPath.length !== 2 || other.label !== "" || traded.has(i)) return false;
          const path = slid(other.drawPath, false, wall.alongRow, k === 0 ? wall.seat : beyond[k - 1][1]);
          if (path === undefined || at === wall.seat) return false;
          traded.set(i, path);
        }
        return tried(traded);
      });
    });
    if (!moved) return;
  }
}
