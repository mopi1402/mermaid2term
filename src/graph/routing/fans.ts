import { type Edge, type Graph } from "../model.js";
import { type GridLayout } from "../layout/grid.js";
import { type NodePlacement } from "../layout/laid.js";
import { HUG_BIAS } from "./pathfinder.js";
import { axisOf } from "../axis.js";
import { placedEdges } from "../layout/edges.js";
import { must } from "../../must.js";
import { arrivesAt, leavesFrom } from "./lanes.js";

interface Fan {
  leaving: Map<string, number>;
  arriving: Map<string, number>;
}

export function countFans(graph: Graph, layout: GridLayout): Fan {
  const fan: Fan = { leaving: new Map(), arriving: new Map() };
  for (const { edge, src: source, tgt: target } of placedEdges(graph, layout, { invisible: true })) {
    const diagonal =
      target.grid.row !== source.grid.row && target.grid.col !== source.grid.col;
    if (!diagonal) continue;
    fan.leaving.set(edge.source, (fan.leaving.get(edge.source) ?? 0) + 1);
    fan.arriving.set(edge.target, (fan.arriving.get(edge.target) ?? 0) + 1);
  }
  return fan;
}

function fanOf(edge: Edge, fan: Fan): string | undefined {
  const leaving = fan.leaving.get(edge.source) ?? 0;
  const arriving = fan.arriving.get(edge.target) ?? 0;
  if (leaving <= 1 && arriving <= 1) return undefined;
  return leaving > arriving ? leavesFrom(edge.source) : arrivesAt(edge.target);
}

export function fansAt(
  edge: Edge,
  src: NodePlacement,
  tgt: NodePlacement,
  fan: Fan,
  horizontal: boolean
): (col: number, row: number, alongRow: boolean) => number {
  const at = fanOf(edge, fan);
  if (at === undefined) return () => 0;
  const hugged = at === leavesFrom(edge.source) ? src : tgt;
  const flow = axisOf(horizontal).along(hugged);
  return (col, row, alongRow) =>
    alongRow === !horizontal ? HUG_BIAS * Math.abs((horizontal ? col : row) - flow) : 0;
}

export function routingOrder(graph: Graph, layout: GridLayout, fan: Fan, horizontal: boolean): number[] {
  const reach = (edge: Edge): number => {
    const source = layout.placements.get(edge.source);
    const target = layout.placements.get(edge.target);
    if (source === undefined || target === undefined) return 0;
    return horizontal ? Math.abs(target.grid.row - source.grid.row) : Math.abs(target.grid.col - source.grid.col);
  };

  const opens = new Map<string, number>();
  const along = (edge: Edge): number => {
    const source = layout.placements.get(edge.source);
    const target = layout.placements.get(edge.target);
    if (source === undefined || target === undefined || !target.mark) return 0;
    return horizontal ? Math.abs(target.grid.col - source.grid.col) : Math.abs(target.grid.row - source.grid.row);
  };
  const held = graph.edges.map((edge, index) => {
    const group = fanOf(edge, fan) ?? (layout.placements.get(edge.target)?.mark === true ? arrivesAt(edge.target) : undefined);
    if (group !== undefined && !opens.has(group)) opens.set(group, index);
    return { index, reach: reach(edge), along: along(edge), anchor: group === undefined ? index : (must(opens.get(group))) };
  });
  return held
    .sort((a, b) => a.anchor - b.anchor || a.along - b.along || b.reach - a.reach || a.index - b.index)
    .map((one) => one.index);
}
