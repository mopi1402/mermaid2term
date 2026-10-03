import { Direction, isHorizontal, normalized, type Graph } from "../model.js";
import { axisOf } from "../axis.js";
import { edgeSides, isWall, placedEdges } from "./edges.js";
import { AttachDir, gapBetweenIsClear } from "../sides.js";
import { type GridLayout } from "./grid.js";
import { type NodePlacement } from "./laid.js";
import { must, oneOf } from "../../must.js";

interface SeatDemand {
  rows: number;
  cols: number;
}

export function sideSeatDemands(graph: Graph, layout: GridLayout, horizontal: boolean): Map<string, SeatDemand> {
  const sides = new Map<string, { arrivals: number; hasDeparture: boolean }>();
  const bump = (id: string, side: AttachDir, arrival: boolean): void => {
    const key = `${id}:${side}`;
    const seat = sides.get(key) ?? { arrivals: 0, hasDeparture: false };
    if (arrival) seat.arrivals += 1;
    else seat.hasDeparture = true;
    sides.set(key, seat);
  };
  const axis = axisOf(horizontal);
  const straightBack = (src: NodePlacement, tgt: NodePlacement): boolean =>
    axis.along(tgt) < axis.along(src) && axis.across(tgt) === axis.across(src) && gapBetweenIsClear(src, tgt, layout);
  for (const { edge, src, tgt, from, to } of edgeSides(graph, layout)) {
    if (src !== undefined && tgt !== undefined && edge.source !== edge.target && straightBack(src, tgt)) continue;
    if (from !== undefined) bump(edge.source, from, false);
    if (to !== undefined) bump(edge.target, to, true);
  }
  const demands = new Map<string, SeatDemand>();
  for (const [key, seat] of sides) {
    const id = key.slice(0, key.lastIndexOf(":"));
    const side = must(oneOf(Object.values(AttachDir), key.slice(key.lastIndexOf(":") + 1)));
    const demand = seat.arrivals + (seat.hasDeparture ? 1 : 0);
    const had = demands.get(id) ?? { rows: 0, cols: 0 };
    if (isWall(side)) had.rows = Math.max(had.rows, demand);
    else had.cols = Math.max(had.cols, demand);
    demands.set(id, had);
  }
  return demands;
}

export function needsFlankLane(graph: Graph, layout: GridLayout, direction: Direction): boolean {
  const horizontal = isHorizontal(normalized(direction));
  const { along, across } = axisOf(horizontal);

  const spans: Array<[number, number]> = [];
  for (const { edge, src, tgt } of placedEdges(graph, layout)) {
    if (edge.source === edge.target || across(src) !== across(tgt)) continue;
    const low = Math.min(along(src), along(tgt));
    const high = Math.max(along(src), along(tgt));
    const own = new Set([edge.source, edge.target]);
    let blocked = false;
    for (let at = low + 1; at < high && !blocked; at++) {
      blocked = horizontal ? !layout.isFree(at, across(src), own) : !layout.isFree(across(src), at, own);
    }
    const back = along(tgt) < along(src);
    if (blocked) spans.push(back ? [low, high] : [low + 1, high - 1]);
  }

  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const [aLow, aHigh] = spans[i];
      const [bLow, bHigh] = spans[j];
      if (aLow < bLow && bLow < aHigh && aHigh < bHigh) return true;
      if (bLow < aLow && aLow < bHigh && bHigh < aHigh) return true;
    }
  }
  return false;
}
