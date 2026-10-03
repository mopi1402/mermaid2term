import { cellId } from "../../canvas/geometry.js";
import { isHorizontal, type Direction, type Edge, type Graph, type Subgraph } from "../model.js";
import { HALF_STRIDE, STRIDE, type GridLayout } from "./grid.js";
import { seatLayer } from "./seating.js";
import { alongReversedNodes, crossesTheFlow, orthogonalSubgraphNodes, subgraphRuns } from "./ordering/subgraph-flow.js";
import { separateBands, subgraphsSharingALayer } from "./bands.js";
import { chainOf, everySubgraph, membersOf } from "../subgraph-tree.js";
import { MARKS } from "../shapes.js";
import { must, pushInto } from "../../must.js";

const ROUNDS = 3;

const MIN_COORD = 1;

export function alignToNeighbours(
  graph: Graph,
  layout: GridLayout,
  layerOrder: string[][],
  direction: Direction,
  flank = 0
): void {
  if (layerOrder.length < 2) return;
  const horizontal = isHorizontal(direction);
  const nearEdge = MIN_COORD + flank;

  // Read the way `setCoord` writes it and not through `axisOf`: the axis is fixed for the call, and a big drawing
  // paid a branch and an indirect call on each of two and a half million lookups.
  const coordOf = (id: string): number => {
    const at = layout.placements.get(id);
    if (at === undefined) return nearEdge;
    return horizontal ? at.grid.row : at.grid.col;
  };
  const setCoord = (id: string, value: number): void => {
    const at = layout.placements.get(id);
    if (at === undefined) return;
    if (horizontal) at.grid.row = value;
    else at.grid.col = value;
  };

  const layerOf = new Map<string, number>();
  layerOrder.forEach((nodes, layer) => nodes.forEach((id) => layerOf.set(id, layer)));

  const orthoSetOf = new Map<string, ReadonlyArray<string>>();
  for (const { nodes } of orthogonalSubgraphNodes(graph)) {
    const members = [...nodes];
    for (const id of members) orthoSetOf.set(id, members);
  }
  const joined = joinsOf(graph, layerOf);

  const onLattice = (coord: number): number => Math.round((coord - nearEdge) / HALF_STRIDE) * HALF_STRIDE + nearEdge;

  const median = (values: number[]): number => {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    if (sorted.length % 2 === 1) return sorted[mid];
    return onLattice(((sorted[mid - 1]) + (sorted[mid])) / 2);
  };

  const pullCoord = (id: string): number => {
    const members = orthoSetOf.get(id);
    if (members === undefined) return coordOf(id);
    let sum = 0;
    for (const member of members) sum += coordOf(member);
    return onLattice(sum / members.length);
  };

  const pullTo = (nodes: string[], layer: number, above: boolean): number[] =>
    nodes.map((id) => {
      const across = (joined.get(id) ?? []).filter((other) => {
        const at = must(layerOf.get(other));
        return above ? at < layer : at > layer;
      });
      return across.length === 0 ? coordOf(id) : median(across.map(pullCoord));
    });

  const anchored = new Set<number>();
  layerOrder.forEach((nodes, layer) => {
    if (nodes.length === 0 || !nodes.every((id) => orthoSetOf.has(id))) return;
    anchored.add(layer);
    nodes.forEach((id, i) => setCoord(id, nearEdge + i * STRIDE));
  });

  const down = [...layerOrder.keys()].slice(1).filter((layer) => !anchored.has(layer));
  const up = [...layerOrder.keys()].slice(0, -1).reverse().filter((layer) => !anchored.has(layer));

  const layerLow: number[] = [];
  const layerHigh: number[] = [];
  const spanOf = (layer: number): void => {
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (const id of layerOrder[layer]) {
      if (!layout.placements.has(id)) continue;
      const at = coordOf(id);
      low = Math.min(low, at);
      high = Math.max(high, at);
    }
    layerLow[layer] = low;
    layerHigh[layer] = high;
  };
  const inALayer = new Set(layerOrder.flat());
  let looseLow = Number.POSITIVE_INFINITY;
  let looseHigh = Number.NEGATIVE_INFINITY;
  for (const [id] of layout.placements) {
    if (inALayer.has(id)) continue;
    looseLow = Math.min(looseLow, coordOf(id));
    looseHigh = Math.max(looseHigh, coordOf(id));
  }

  // The span each layer is seated against is carried forward, not read off every placement once per layer and per
  // pass, which made the whole alignment quadratic in the node count.
  const sweep = (order: number[], seats: ReadonlySet<number>, above: boolean): void => {
    for (let layer = 0; layer < layerOrder.length; layer++) spanOf(layer);
    const restLow = new Array<number>(order.length + 1).fill(Number.POSITIVE_INFINITY);
    const restHigh = new Array<number>(order.length + 1).fill(Number.NEGATIVE_INFINITY);
    for (let at = order.length - 1; at >= 0; at--) {
      restLow[at] = Math.min(restLow[at + 1], layerLow[order[at]]);
      restHigh[at] = Math.max(restHigh[at + 1], layerHigh[order[at]]);
    }
    let pastLow = looseLow;
    let pastHigh = looseHigh;
    for (let at = 0; at < order.length; at++) {
      const layer = order[at];
      if (seats.has(layer)) {
        const nodes = layerOrder[layer];
        const rest = { low: Math.min(pastLow, restLow[at + 1]), high: Math.max(pastHigh, restHigh[at + 1]) };
        seatLayer(nodes, pullTo(nodes, layer, above), rest.low, rest.high, nearEdge, onLattice, setCoord);
        spanOf(layer);
      }
      pastLow = Math.min(pastLow, layerLow[layer]);
      pastHigh = Math.max(pastHigh, layerHigh[layer]);
    }
  };

  const downOrder = [...layerOrder.keys()];
  const upOrder = [...layerOrder.keys()].reverse();
  const downSeats = new Set(down);
  const upSeats = new Set(up);
  for (let round = 0; round < ROUNDS; round++) {
    sweep(downOrder, downSeats, true);
    sweep(upOrder, upSeats, false);
  }
  const last = down[down.length - 1];
  if (last !== undefined) pullLastLayer(layerOrder[last], last, pullTo(layerOrder[last], last, true), joined, layerOf, coordOf, setCoord);

  separateBands(graph, layerOf, coordOf, setCoord);
  backToEdge(layerOf, nearEdge, coordOf, setCoord);
  centreFramesAlong(graph, layout, horizontal);
  occupy(layout);
}

// Which nodes each node is pulled toward: the ends of its runs between two layers, forward or along a mirrored
// frame, where neither end stands alone in a frame the other is outside of.
function joinsOf(graph: Graph, layerOf: Map<string, number>): Map<string, string[]> {
  const joined = new Map<string, string[]>();
  const join = (from: string, to: string): void => pushInto(joined, from, to);
  const chains = new Map<string, Set<string>>();
  for (const id of graph.nodeOrder) chains.set(id, chainOf(graph, id));
  const crowded = subgraphsSharingALayer(chains, layerOf);

  const holds = (node: string, other: string): boolean => {
    const inner = chains.get(node) ?? new Set<string>();
    const outer = chains.get(other) ?? new Set<string>();
    for (const sg of inner) if (crowded.has(sg) && !outer.has(sg)) return false;
    for (const sg of outer) if (crowded.has(sg) && !inner.has(sg)) return false;
    return true;
  };

  const mirrored = alongReversedNodes(graph);
  const mirrors = (edge: Edge): boolean =>
    mirrored.some((set) => set.has(edge.source) && set.has(edge.target));

  // A node whose one run on that side is a box lines up on the box, judged by the frames around it, the box being
  // no frame it crosses. The box is not pulled back onto the node, its members keep their own seats.
  const around = (box: Subgraph): Set<string> => {
    const held = new Set<string>();
    for (let at = box.parent; at !== undefined; at = at.parent) held.add(at.id);
    return held;
  };
  const clears = (node: string, box: Subgraph): boolean => {
    // A mark is seated on its runs once the frames stand, by `centreMarks`, never pulled across a lane here.
    const shape = graph.nodes.get(node)?.shape;
    if (shape === undefined || MARKS.has(shape)) return false;
    const inner = chains.get(node) ?? new Set<string>();
    const outer = around(box);
    for (const sg of inner) if (crowded.has(sg) && !outer.has(sg)) return false;
    for (const sg of outer) if (crowded.has(sg) && !inner.has(sg)) return false;
    return true;
  };
  const leaving = new Map<string, number>();
  const arriving = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.source === edge.target) continue;
    leaving.set(edge.source, (leaving.get(edge.source) ?? 0) + 1);
    arriving.set(edge.target, (arriving.get(edge.target) ?? 0) + 1);
  }
  const runs = [...graph.edges.map((edge) => ({ edge, sourceBox: undefined, targetBox: undefined })), ...subgraphRuns(graph)];
  for (const { edge, sourceBox, targetBox } of runs) {
    if (edge.source === edge.target) continue;
    if (!layerOf.has(edge.source) || !layerOf.has(edge.target)) continue;
    const from = must(layerOf.get(edge.source));
    const to = must(layerOf.get(edge.target));
    if (from === to || (from > to && !mirrors(edge))) continue;
    if (holds(edge.source, edge.target)) {
      join(edge.source, edge.target);
      join(edge.target, edge.source);
    } else if (targetBox !== undefined && sourceBox === undefined && leaving.get(edge.source) === 1 && clears(edge.source, targetBox)) {
      join(edge.source, edge.target);
    } else if (sourceBox !== undefined && targetBox === undefined && arriving.get(edge.target) === 1 && clears(edge.target, sourceBox)) {
      join(edge.target, edge.source);
    }
  }
  return joined;
}

// The last layer's node with two parents or more takes the seat they pull it to, where no other node of its layer
// stands within a stride of it.
function pullLastLayer(
  nodes: readonly string[],
  last: number,
  wants: readonly number[],
  joined: ReadonlyMap<string, string[]>,
  layerOf: ReadonlyMap<string, number>,
  coordOf: (id: string) => number,
  setCoord: (id: string, value: number) => void
): void {
  nodes.forEach((id, i) => {
    const parents = (joined.get(id) ?? []).filter((other) => (must(layerOf.get(other))) < last);
    const want = wants[i];
    if (parents.length < 2 || want === coordOf(id)) return;
    const free = nodes.every((other) => other === id || Math.abs(coordOf(other) - want) >= STRIDE);
    if (free) setCoord(id, want);
  });
}

// Every layered node slid back together so the lowest stands on the near edge.
function backToEdge(layerOf: ReadonlyMap<string, number>, nearEdge: number, coordOf: (id: string) => number, setCoord: (id: string, value: number) => void): void {
  let lowest = Number.POSITIVE_INFINITY;
  for (const id of layerOf.keys()) lowest = Math.min(lowest, coordOf(id));
  if (lowest !== nearEdge) {
    const back = nearEdge - lowest;
    for (const id of layerOf.keys()) setCoord(id, coordOf(id) + back);
  }
}

// The cells each node's seat and its ring of eight hold.
function occupy(layout: GridLayout): void {
  layout.gridOccupied.clear();
  for (const [id, at] of layout.placements) {
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) layout.gridOccupied.set(cellId(at.grid.col + dc, at.grid.row + dr), id);
    }
  }
}

// A frame nested in one that crosses the flow stands on the layers of its own members, where mermaid centres it in its
// parent: it slides along the flow, half a stride at a time, onto the middle of the layers the parent holds.
function centreFramesAlong(graph: Graph, layout: GridLayout, horizontal: boolean): void {
  const along = (id: string): number => {
    const at = must(layout.placements.get(id)).grid;
    return horizontal ? at.col : at.row;
  };
  const across = (id: string): number => {
    const at = must(layout.placements.get(id)).grid;
    return horizontal ? at.row : at.col;
  };
  const placed = (sg: Subgraph): string[] => [...membersOf(sg)].filter((id) => layout.placements.has(id));
  const spanOf = (ids: string[], of: (id: string) => number): [number, number] =>
    [Math.min(...ids.map(of)), Math.max(...ids.map(of))];
  for (const parent of everySubgraph(graph)) {
    if (!crossesTheFlow(parent, graph)) continue;
    const all = placed(parent);
    if (all.length === 0) continue;
    const [low, high] = spanOf(all, along);
    for (const child of parent.children) {
      const held = placed(child);
      if (held.length === 0) continue;
      const [from, to] = spanOf(held, along);
      const shift = Math.floor((low + high - from - to) / 2 / HALF_STRIDE) * HALF_STRIDE;
      if (shift === 0) continue;
      const [side, far] = spanOf(held, across);
      const own = new Set(held);
      const blocked = [...layout.placements.keys()].some(
        (id) => !own.has(id) && across(id) > side - STRIDE && across(id) < far + STRIDE && along(id) > from + shift - STRIDE && along(id) < to + shift + STRIDE
      );
      if (blocked) continue;
      for (const id of held) {
        const at = must(layout.placements.get(id)).grid;
        if (horizontal) at.col += shift;
        else at.row += shift;
      }
    }
  }
}
