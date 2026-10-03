import { type Edge, type Graph } from "../model.js";
import { orderedByOneParent } from "../layout/ordering/subgraph-flow.js";
import { membersOf } from "../subgraph-tree.js";
import { frameRoom, makePlacement, midCol, midRow, type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { type NodePlacement } from "../layout/laid.js";
import { axisOf } from "../axis.js";
import { clamp, must } from "../../must.js";

const JOG_CLEARANCE = 3;

const same = (a: [number, number], b: [number, number]): boolean => a[0] === b[0] && a[1] === b[1];

// A short first leg before a turn is pushed out to JOG_CLEARANCE, when the path goes on past it; false when the first two legs do not run that way.
function clearJog(next: Array<[number, number]>, axis: 0 | 1): boolean {
  const cross = 1 - axis;
  const [c, n, m, p] = next;
  if (c[cross] !== n[cross] || n[axis] !== m[axis] || Math.abs(c[axis] - n[axis]) >= JOG_CLEARANCE) return false;
  const sign = c[axis] > n[axis] ? 1 : -1;
  const shifted = c[axis] - JOG_CLEARANCE * sign;
  if ((sign > 0 && p[axis] < shifted) || (sign < 0 && p[axis] > shifted)) {
    const at = (q: [number, number]): [number, number] => (axis === 0 ? [shifted, q[1]] : [q[0], shifted]);
    next[1] = at(n);
    next[2] = at(m);
  }
  return true;
}

export function subgraphMembers(sb: SubgraphBounds, layout: GridLayout): NodePlacement[] {
  const ids = membersOf(sb.subgraph);
  const members: NodePlacement[] = [];
  for (const id of ids) {
    const p = layout.placements.get(id);
    if (p !== undefined) members.push(p);
  }
  return members;
}

export function resolveEndpoints(
  graph: Graph,
  edge: Edge,
  layout: GridLayout,
  sgBounds: ReadonlyMap<string, SubgraphBounds>,
  horizontal: boolean
): [NodePlacement | undefined, NodePlacement | undefined] {
  if (!edge.sourceIsSubgraph && !edge.targetIsSubgraph) {
    return [layout.placements.get(edge.source) ?? undefined, layout.placements.get(edge.target) ?? undefined];
  }

  const candidates = (nodeId: string, isSubgraph: boolean): NodePlacement[] => {
    if (!isSubgraph) {
      const p = layout.placements.get(nodeId);
      return p === undefined ? [] : [p];
    }
    const sb = sgBounds.get(nodeId);
    return sb === undefined ? [] : subgraphMembers(sb, layout);
  };

  const sources = candidates(edge.source, edge.sourceIsSubgraph);
  const targets = candidates(edge.target, edge.targetIsSubgraph);
  if (sources.length === 0 || targets.length === 0) return [undefined, undefined];

  let best: [NodePlacement, NodePlacement] | undefined;
  let bestKey: [number, string, string] | undefined;
  for (const s of sources) {
    for (const t of targets) {
      const [sx, sy] = [midCol(s), midRow(s)];
      const [tx, ty] = [midCol(t), midRow(t)];
      const key: [number, string, string] = [Math.abs(sx - tx) + Math.abs(sy - ty), s.nodeId, t.nodeId];
      if (
        bestKey === undefined ||
        key[0] < bestKey[0] ||
        (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))
      ) {
        best = [s, t];
        bestKey = key;
      }
    }
  }
  if (best === undefined) return [undefined, undefined];

  const axis = axisOf(horizontal);
  // The other end's own lane when the box spans it; along the flow only between two boxes stacked across it, which
  // then meet straight, where a box spanning a node's layer would be entered by its side.
  const stacked = edge.sourceIsSubgraph && edge.targetIsSubgraph && orderedByOneParent(graph, edge.source, edge.target);
  const reached = (nodeId: string, member: NodePlacement, other: NodePlacement, of: (p: NodePlacement) => number): number => {
    const own = of(other);
    const sb = must(sgBounds.get(nodeId));
    const cells = subgraphMembers(sb, layout).map(of);
    const reaches = Math.min(...cells) <= own && own <= Math.max(...cells);
    return reaches ? own : of(member);
  };
  const along = (p: NodePlacement): number => axis.along(p);
  const across = (p: NodePlacement): number => axis.across(p);

  const virtualize = (nodeId: string, isSubgraph: boolean, member: NodePlacement, other: NodePlacement): NodePlacement => {
    if (!isSubgraph) return member;
    const sb = must(sgBounds.get(nodeId));
    const [col, row] = axis.cell(stacked ? reached(nodeId, member, other, along) : along(member), reached(nodeId, member, other, across));
    const grid = { col, row };
    const p = makePlacement(nodeId, grid);
    // Across a horizontal flow the box is met on the middle of what it holds, below its name, where the layout
    // centres its content: the middle of the whole frame falls a row higher under a composite's taller lid.
    const { lid, floor } = frameRoom(sb.subgraph, layout);
    const held = horizontal && sb.height > lid + floor;
    p.drawX = sb.x;
    p.drawY = held ? sb.y + lid : sb.y;
    p.drawWidth = sb.width;
    p.drawHeight = held ? sb.height - lid - floor : sb.height;
    return p;
  };

  return [
    virtualize(edge.source, edge.sourceIsSubgraph, best[0], best[1]),
    virtualize(edge.target, edge.targetIsSubgraph, best[1], best[0]),
  ];
}

// Only onto the rows the box holds: a mark level with its lid would run into the name or the rule over it.
export function straightenMarkToBox(drawPath: Array<[number, number]>, sb: SubgraphBounds, horizontal: boolean, layout: GridLayout): void {
  if (drawPath.length < 2) return;
  const [fx, fy] = drawPath[0];
  const [lx, ly] = drawPath[drawPath.length - 1];
  const x1 = sb.x + sb.width - 1;
  const y1 = sb.y + sb.height - 1;
  if (horizontal) {
    if ((lx !== sb.x && lx !== x1) || fy < sb.y + frameRoom(sb.subgraph, layout).lid || fy >= y1 || fx === lx) return;
    drawPath.splice(0, drawPath.length, [fx, fy], [lx, fy]);
  } else {
    if ((ly !== sb.y && ly !== y1) || fx <= sb.x || fx >= x1 || fy === ly) return;
    drawPath.splice(0, drawPath.length, [fx, fy], [fx, ly]);
  }
}

export function clipEndpointToBox(drawPath: Array<[number, number]>, sb: SubgraphBounds, fromStart: boolean): void {
  if (drawPath.length < 2) return;

  const pts = fromStart ? drawPath.slice() : drawPath.slice().reverse();
  const x0 = sb.x;
  const y0 = sb.y;
  const x1 = sb.x + sb.width - 1;
  const y1 = sb.y + sb.height - 1;
  const strictlyInside = (p: [number, number]): boolean => x0 < p[0] && p[0] < x1 && y0 < p[1] && p[1] < y1;

  let k = 0;
  while (k < pts.length && strictlyInside(pts[k])) k++;
  if (k >= pts.length) return;

  let next: Array<[number, number]>;
  if (k === 0) {
    const [ax, ay] = pts[0];
    const [bx] = pts[1];
    const clamped: [number, number] =
      ax === bx ? [ax, clamp(ay, y0, y1)] : [clamp(ax, x0, x1), ay];
    next = [clamped, ...pts.slice(1)];
  } else {
    const [px, py] = pts[k - 1];
    const [qx, qy] = pts[k];
    const cross: [number, number] = px === qx ? [px, qy > py ? y1 : y0] : [qx > px ? x1 : x0, py];
    next = [cross, ...pts.slice(k)];
  }

  if (next.length >= 2 && same(next[0], next[1])) next = next.slice(1);
  if (next.length < 2) return;

  if (next.length >= 4 && !clearJog(next, 1)) clearJog(next, 0);

  drawPath.length = 0;
  drawPath.push(...(fromStart ? next : next.reverse()));
}
