import { type Graph } from "../model.js";
import { NodeShape } from "../shapes.js";
import { makePlacement, MAX_SPREAD_STEP, type GridLayout, type Pitch, type SubgraphBounds } from "../layout/grid.js";
import { type NodePlacement } from "../layout/laid.js";
import { drumWalls } from "../layout/padless.js";
import { lidded } from "../layout/boxes.js";
import { cellId } from "./pathfinder.js";
import { AttachDir } from "../sides.js";
import { must, pushInto } from "../../must.js";
import { cellsOfPath, markPaths, riddenBy, type RoutedEdge, type Endpoint } from "./routed.js";
import { applySpread } from "./spread-seats.js";
import { pairOf } from "../layout/parallels.js";

const pointKey = (p: [number, number]): string => cellId(p[0], p[1]);

interface Held {
  e: Endpoint;
  side: number;
  reach: number;
}

const endpointAt = (re: RoutedEdge, atEnd: boolean): [number, number] =>
  (atEnd ? re.drawPath[re.drawPath.length - 1] : re.drawPath[0]);

function fanDepartures(group: Endpoint[], point: [number, number], placement: NodePlacement, walls?: [number, number], shared = true): void {
  if (placement.mark) return;
  const [px, py] = point;
  const attach = group[0].re.startDir;
  if (group.some((e) => e.re.startDir !== attach)) return;

  const alongX = attach === AttachDir.TOP || attach === AttachDir.BOTTOM;
  const axis = alongX ? 0 : 1;
  const from = alongX ? px : py;
  const low = alongX || walls === undefined ? (alongX ? placement.drawX : placement.drawY) + 1 : walls[0];
  const high = alongX || walls === undefined ? (alongX ? placement.drawX + placement.drawWidth : placement.drawY + placement.drawHeight) - 2 : walls[1];

  const turning: Held[] = [];
  for (const e of group) {
    const path = e.re.drawPath;
    if (path[1][axis] !== from) continue;
    const turn = path.find((cell) => cell[axis] !== from);
    if (turn === undefined) continue;
    const end = path[path.length - 1];
    turning.push({ e, side: Math.sign(turn[axis] - from), reach: Math.abs(end[axis] - from) });
  }

  const nesting = (side: number): Held[] => turning.filter((held) => held.side === side).sort((a, b) => a.reach - b.reach);
  const runs = new Map<number, Held[]>([
    [-1, nesting(-1)],
    [1, nesting(1)],
  ]);
  const room = (side: number): number => (side > 0 ? high - from : from - low);
  const spill = new Map<number, number>([
    [-1, Math.max(0, (must(runs.get(-1))).length - room(-1))],
    [1, Math.max(0, (must(runs.get(1))).length - room(1))],
  ]);
  const free = (side: number): number => Math.max(0, room(side) - (must(runs.get(side))).length);
  const wanted = new Map(spill);
  spill.set(-1, Math.min(must(wanted.get(-1)), free(1)));
  spill.set(1, Math.min(must(wanted.get(1)), free(-1)));

  const taken = new Set<number>([from]);
  for (const side of [-1, 1]) {
    const mine = must(runs.get(side));
    const lent = (must(runs.get(-side))).slice(0, must(spill.get(-side)));
    const leaving = [...lent.reverse(), ...mine.slice(must(spill.get(side)))];
    if (leaving.length === 0) continue;
    // The legs turning one way share that half of a box's side out evenly, the last as far from the corner as the next,
    // never closer than they stood; a frame's keep to the tight step.
    const tight = Math.max(1, Math.min(MAX_SPREAD_STEP, Math.floor(room(side) / leaving.length)));
    const step = shared ? Math.max(tight, Math.floor(room(side) / (leaving.length + 1))) : tight;
    const first = step;
    leaving.forEach((held, rank) => {
      const path = held.e.re.drawPath;
      const stub = path[1];
      const to = Math.max(low, Math.min(high, from + side * (first + step * rank)));
      if (taken.has(to)) return;
      taken.add(to);
      path[0] = alongX ? [to, py] : [px, to];
      path[1] = alongX ? [to, stub[1]] : [stub[0], to];
    });
  }
}

// Links joining the same two boxes straight take seats a label's room apart, whole runs moved so both ends follow.
function seatParallels(group: readonly Endpoint[], pitch: Pitch, point: [number, number], placement: NodePlacement, walls?: [number, number]): boolean {
  if (placement.mark || group.length !== pitch.steps.length + 1) return false;
  const pair = pairOf(group[0].re.edge);
  if (group.some((e) => pairOf(e.re.edge) !== pair)) return false;
  const attach = group[0].atEnd ? group[0].re.endDir : group[0].re.startDir;
  const axis = attach === AttachDir.TOP || attach === AttachDir.BOTTOM ? 0 : 1;
  const run = (e: Endpoint): Array<[number, number]> => e.re.drawPath;
  if (group.some((e) => run(e).some((cell) => cell[axis] !== run(e)[0][axis]))) return false;
  const [low, high] =
    axis === 0
      ? [placement.drawX + 1, placement.drawX + placement.drawWidth - 2]
      : (walls ?? [placement.drawY + 1, placement.drawY + placement.drawHeight - 2]);
  const span = pitch.steps.reduce((sum, step) => sum + step, 0);
  const first = low + pitch.before;
  const last = high - pitch.after - span;
  if (first > last) return false;
  let seat = Math.max(first, Math.min(last, point[axis] - Math.floor(span / 2)));
  [...group]
    .sort((a, b) => a.re.index - b.re.index)
    .forEach((e, rank) => {
      for (const cell of run(e)) cell[axis] = seat;
      seat += pitch.steps[rank] ?? 0;
    });
  return true;
}

export type WallsOf = (nodeId: string) => [number, number] | undefined;

// The rows a link may meet a box's side on: below a drum's lid, below a lidded box's rule, where a tee would cross it.
export function drumWallsOf(graph: Graph, layout: GridLayout): WallsOf {
  return (nodeId) => {
    const p = layout.placements.get(nodeId);
    const shape = graph.nodes.get(nodeId)?.shape;
    if (p === undefined || shape === undefined) return undefined;
    if (lidded(shape)) return p.drawHeight >= 4 ? [p.drawY + 2, p.drawY + p.drawHeight - 2] : undefined;
    if (shape !== NodeShape.CYLINDER) return undefined;
    const seat = layout.drums.get(nodeId);
    if (seat !== undefined) return drumWalls(seat, p.drawY, p.drawHeight);
    const lidRow = p.drawHeight >= 4 ? p.drawY + 1 : p.drawY;
    return [lidRow + 1, p.drawY + p.drawHeight - 2];
  };
}

// A fan leg left alone on its seat once its siblings were seated away, whose first run another edge still rides.
function stubRidden(routed: RoutedEdge[], e: Endpoint): boolean {
  const [start, turn] = e.re.drawPath;
  const marks = markPaths(routed);
  const index = routed.indexOf(e.re);
  const alongRow = start[1] === turn[1];
  return [...cellsOfPath([start, turn])].some((cell) => cell !== pointKey(start) && riddenBy(marks, cell, index, alongRow));
}

export function spreadSharedEndpoints(
  routed: RoutedEdge[],
  layout: GridLayout,
  sgBounds: ReadonlyMap<string, SubgraphBounds>,
  wallsOf: WallsOf = () => undefined
): void {
  const groups = new Map<string, Endpoint[]>();
  const add = (re: RoutedEdge, atEnd: boolean): void => pushInto(groups, pointKey(endpointAt(re, atEnd)), { re, atEnd });
  for (const re of routed) {
    if (re.drawPath.length < 2) continue;
    add(re, true);
    add(re, false);
  }

  const placementOf = (nodeId: string): NodePlacement | undefined => {
    const placed = layout.placements.get(nodeId);
    if (placed !== undefined) return placed;
    const sb = sgBounds.get(nodeId);
    if (sb === undefined) return undefined;
    const box = makePlacement(nodeId, { col: 0, row: 0 });
    box.drawX = sb.x;
    box.drawY = sb.y;
    box.drawWidth = sb.width;
    box.drawHeight = sb.height;
    return box;
  };

  for (const [key, members] of groups) {
    const group = members.filter((e) => pointKey(endpointAt(e.re, e.atEnd)) === key);
    const arrivals = group.filter((e) => e.atEnd);
    const lone = group.length === 1 && members.length > 1 && arrivals.length === 0 && stubRidden(routed, group[0]);
    if (group.length <= 1 && !lone) continue;
    if (arrivals.length === 0) {
      const leaving = group[0].re;
      const node = placementOf(leaving.edge.source);
      if (node !== undefined) fanDepartures(group, endpointAt(leaving, false), node, wallsOf(node.nodeId), layout.placements.has(node.nodeId));
      continue;
    }
    const moving = arrivals.length === group.length ? arrivals : group;
    const first = moving[0];
    const point = endpointAt(first.re, first.atEnd);
    const node = placementOf(first.atEnd ? first.re.edge.target : first.re.edge.source);
    if (node === undefined) continue;
    const pitch = layout.parallels.get(pairOf(first.re.edge));
    if (pitch !== undefined && seatParallels(moving, pitch, point, node, wallsOf(node.nodeId))) continue;
    applySpread(moving, point, node, wallsOf(node.nodeId), layout.placements.has(node.nodeId), [...layout.placements.values()]);
  }
}
