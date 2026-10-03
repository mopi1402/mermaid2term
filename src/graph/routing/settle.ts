import { type Edge, type Graph } from "../model.js";
import { NodeShape } from "../shapes.js";
import { midCol, midRow, type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { type NodePlacement } from "../layout/laid.js";
import { cellId, simplifyPath } from "./pathfinder.js";
import type { Point } from "../../canvas/cells.js";
import { AttachDir } from "../sides.js";
import { axisOf } from "../axis.js";
import { must } from "../../must.js";
import { resolveEndpoints } from "./endpoints.js";
import { snapToMark } from "./one-edge.js";
import { type RoutedEdge } from "./routed.js";

interface Settled {
  path: Point[];
  from: AttachDir;
  to: AttachDir;
}

export function settleMarkPaths(
  graph: Graph,
  layout: GridLayout,
  horizontal: boolean,
  sgBounds: ReadonlyMap<string, SubgraphBounds>
): Map<number, Settled> {
  const settled = new Map<number, Settled>();
  const { along, across, cell, ahead, behind, before, after } = axisOf(horizontal);
  const opposite = (d: AttachDir): AttachDir => (d === ahead ? behind : ahead);
  const span = (lo: number, hi: number): number[] => {
    const out: number[] = [];
    for (let v = Math.min(lo, hi); v <= Math.max(lo, hi); v++) out.push(v);
    return out;
  };
  const clear = (cells: Point[], edge: Edge, src: NodePlacement, tgt: NodePlacement): boolean => {
    const own = new Set([edge.source, edge.target, src.nodeId, tgt.nodeId]);
    for (const p of [src, tgt]) {
      const owner = layout.gridOccupied.get(cellId(p.grid.col, p.grid.row));
      if (owner !== undefined) own.add(owner);
    }
    return cells.every(([c, r]) => layout.isFree(c, r, own));
  };
  const ends = (edge: Edge): [NodePlacement, NodePlacement] | undefined => {
    if (edge.sourceIsSubgraph) return undefined;
    const [src, tgt] = resolveEndpoints(graph, edge, layout, sgBounds, horizontal);
    if (src === undefined || tgt === undefined || along(src) === along(tgt)) return undefined;
    return [src, tgt];
  };

  const rowsTaken = new Map<string, Set<number>>();
  graph.edges.forEach((edge, index) => {
    const pair = ends(edge);
    if (pair === undefined || !pair[0].mark) return;
    const [mark, tgt] = pair;
    const sign = Math.sign(along(tgt) - along(mark));
    const attach = along(mark) + sign;
    let spine = attach;
    const blocked = (a: number): boolean => !layout.isFree(...cell(a, across(mark)));
    while (blocked(spine) && Math.abs(spine - along(mark)) < Math.abs(along(tgt) - along(mark))) spine += sign;
    const rows = rowsTaken.get(edge.source) ?? new Set<number>();
    rowsTaken.set(edge.source, rows);
    if (rows.has(across(tgt))) return;
    const trunk = span(across(mark), across(tgt)).map((x) => cell(spine, x));
    const branch = span(spine, along(tgt) - sign).map((a) => cell(a, across(tgt)));
    if (!clear([...trunk, ...branch], edge, mark, tgt)) return;
    rows.add(across(tgt));
    const from = sign > 0 ? ahead : behind;
    settled.set(index, {
      path: [cell(attach, across(mark)), cell(spine, across(mark)), cell(spine, across(tgt)), cell(along(tgt) - sign, across(tgt))],
      from,
      to: opposite(from),
    });
  });

  const arriving = new Map<string, number[]>();
  graph.edges.forEach((edge, index) => {
    const pair = ends(edge);
    if (pair === undefined || !pair[1].mark || settled.has(index)) return;
    const list = arriving.get(edge.target) ?? [];
    list.push(index);
    arriving.set(edge.target, list);
  });
  for (const indices of arriving.values()) {
    const seats = new Set<AttachDir>();
    const byNearness = indices
      .map((index) => {
        const [src, mark] = must(ends(graph.edges[index]));
        return { index, src, mark, off: Math.abs(across(src) - across(mark)) };
      })
      .sort((a, b) => a.off - b.off || a.index - b.index);
    for (const { index, src, mark, off } of byNearness) {
      const sign = Math.sign(along(mark) - along(src));
      const start = cell(along(src) + sign, across(src));
      const from = sign > 0 ? ahead : behind;
      if (off === 0) {
        const to = opposite(from);
        if (seats.has(to)) continue;
        const run = span(along(src) + sign, along(mark) - sign).map((a) => cell(a, across(src)));
        if (!clear(run, graph.edges[index], src, mark)) continue;
        seats.add(to);
        settled.set(index, { path: [start, cell(along(mark) - sign, across(mark))], from, to });
        continue;
      }
      const to = across(src) < across(mark) ? before : after;
      if (seats.has(to)) continue;
      const step = across(src) < across(mark) ? 1 : -1;
      const run = span(along(src) + sign, along(mark)).map((a) => cell(a, across(src)));
      const drop = span(across(src), across(mark) - step).map((x) => cell(along(mark), x));
      if (!clear([...run, ...drop], graph.edges[index], src, mark)) continue;
      seats.add(to);
      settled.set(index, {
        path: [start, cell(along(mark), across(src)), cell(along(mark), across(mark) - step)],
        from,
        to,
      });
    }
  }
  return settled;
}

const sameCell = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1];

function isWideMark(graph: Graph, p: NodePlacement): boolean {
  return p.mark && graph.nodes.get(p.nodeId)?.shape === NodeShape.CHOICE_STATE;
}

// Moves the points on the spine lane next to the mark, on the near edge of that lane when it lies ahead.
function pinToSpine(
  graph: Graph,
  src: NodePlacement,
  layout: GridLayout,
  sideways: boolean,
  spine: number,
  ahead: boolean,
  cells: readonly Point[],
  points: ReadonlyArray<[number, number]>
): void {
  const size = (sideways ? layout.colWidths.get(spine) : layout.rowHeights.get(spine)) ?? 1;
  const wide = sideways && isWideMark(graph, src) ? 1 : 0;
  const [sx, sy] = layout.gridToDraw(sideways ? spine : 0, sideways ? 0 : spine);
  const edge0 = (sideways ? sx : sy) + (ahead ? Math.min(1 + wide, size - 1) : Math.max(0, size - 2 - wide));
  cells.forEach((cell, i) => {
    if ((sideways ? cell[0] : cell[1]) !== spine) return;
    const point = points[i];
    if (sideways) point[0] = edge0;
    else point[1] = edge0;
  });
}

export function settleEdge(graph: Graph, edge: Edge, src: NodePlacement, tgt: NodePlacement, layout: GridLayout, chosen: Settled): RoutedEdge {
  const distinct = chosen.path.filter((one, i) => i === 0 || !sameCell(one, chosen.path[i - 1]));
  const simplified = simplifyPath(distinct);
  let drawPath = simplified.map(([c, r]) => layout.gridToDrawCenter(c, r));
  if (src.mark && distinct.length >= 3) {
    const sideways = chosen.from === AttachDir.LEFT || chosen.from === AttachDir.RIGHT;
    const alongOf = (cell: Point): number => (sideways ? cell[0] : cell[1]);
    const spine = alongOf(distinct[1]);
    const ahead = spine > alongOf(distinct[0]) || spine > (sideways ? src.grid.col : src.grid.row);
    pinToSpine(graph, src, layout, sideways, spine, ahead, simplified, drawPath);
  }
  const finish = (path: Array<[number, number]>): RoutedEdge => ({
    edge,
    gridPath: simplified,
    drawPath: path,
    startDir: chosen.from,
    endDir: chosen.to,
    label: edge.label,
    index: 0,
    occupiedCells: new Set(chosen.path.map(([c, r]) => cellId(c, r))),
  });
  if (tgt.mark) snapToMark(drawPath, tgt, chosen.to, true);
  if (src.mark) {
    const sideways = chosen.from === AttachDir.LEFT || chosen.from === AttachDir.RIGHT;
    const mx = midCol(src);
    const my = midRow(src);
    const lane = sideways ? src.grid.row : src.grid.col;
    const laneCentre = layout.gridToDrawCenter(src.grid.col, src.grid.row)[sideways ? 1 : 0];
    if ((sideways ? my : mx) === laneCentre) {
      snapToMark(drawPath, src, chosen.from, false);
      return finish(drawPath);
    }
    const onLane = (cell: Point): boolean => (sideways ? cell[1] : cell[0]) === lane;
    const points = distinct.map(([c, r]) => layout.gridToDrawCenter(c, r));
    if (distinct.length >= 3) {
      const spineAt = sideways ? distinct[1][0] : distinct[1][1];
      pinToSpine(graph, src, layout, sideways, spineAt, spineAt > (sideways ? src.grid.col : src.grid.row), distinct, points);
    }
    const last = points.length - 1;
    for (let i = 0; i < last; i++) {
      if (!onLane(distinct[i])) continue;
      const point = points[i];
      if (sideways) point[1] = my;
      else point[0] = mx;
    }
    const end = points[last];
    if (sideways) end[1] = midRow(tgt);
    else end[0] = midCol(tgt);
    const [ex, ey] = end;
    const [bx, by] = points[last - 1];
    if (ex !== bx && ey !== by) points.splice(last, 0, sideways ? [bx, ey] : [ex, by]);
    const kept: Array<[number, number]> = [];
    for (const one of points) {
      const prev = kept[kept.length - 1];
      if (prev !== undefined && prev[0] === one[0] && prev[1] === one[1]) continue;
      const before = kept[kept.length - 2];
      if (prev !== undefined && before !== undefined && ((before[0] === prev[0] && prev[0] === one[0]) || (before[1] === prev[1] && prev[1] === one[1]))) {
        kept[kept.length - 1] = one;
        continue;
      }
      kept.push(one);
    }
    drawPath = kept;
    snapToMark(drawPath, src, chosen.from, false);
  }
  return finish(drawPath);
}
