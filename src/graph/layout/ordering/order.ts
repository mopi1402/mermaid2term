import { isSelfReference, type Graph } from "../../model.js";
import { STATE_POINTS } from "../../shapes.js";
import { must, pushInto } from "../../../must.js";
import { topoOrder } from "../../topo.js";
import { orthogonalSubgraphNodes } from "./subgraph-flow.js";
import { seedOrder } from "./seed.js";

const MAX_PASSES = 8;

const MAX_FRUITLESS = 4;

interface Seat {
  layer: number;
  pos: number;
}

const seatsOf = (layerLists: string[][]): Map<string, Seat> => {
  const seats = new Map<string, Seat>();
  layerLists.forEach((nodes, layer) => nodes.forEach((id, pos) => seats.set(id, { layer, pos })));
  return seats;
};

function countCrossings(graph: Graph, layerLists: string[][]): number {
  const seats = seatsOf(layerLists);
  const between = new Map<number, Array<[number, number]>>();
  for (const edge of graph.edges) {
    const from = seats.get(edge.source);
    const to = seats.get(edge.target);
    if (from === undefined || to === undefined || to.layer !== from.layer + 1) continue;
    const bucket = between.get(to.layer);
    if (bucket === undefined) between.set(to.layer, [[from.pos, to.pos]]);
    else bucket.push([from.pos, to.pos]);
  }
  let total = 0;
  for (const pairs of between.values()) {
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const [u1, v1] = pairs[i];
        const [u2, v2] = pairs[j];
        if ((u1 - u2) * (v1 - v2) < 0) total++;
      }
    }
  }
  return total;
}

export function orderLayers(graph: Graph, layers: Map<string, number>): string[][] {
  const maxLayer = layers.size > 0 ? Math.max(...layers.values()) : 0;
  let layerLists: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const id of seedOrder(graph)) (layerLists[layers.get(id) ?? 0]).push(id);

  let bestCrossings = countCrossings(graph, layerLists);
  let bestOrdering = layerLists.map((layer) => layer.slice());
  let fruitless = 0;

  // Read once: asked inside the per-node loop it walked every edge of the graph per node, per layer, per pass.
  const sourcesOf = new Map<string, string[]>();
  for (const edge of graph.edges) pushInto(sourcesOf, edge.target, edge.source);

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    for (let layer = 1; layer < layerLists.length; layer++) {
      const prev = new Map(layerLists[layer - 1].map((id, i) => [id, i]));
      const nodes = layerLists[layer];
      const startPos = new Map(nodes.map((id, i) => [id, i]));
      const barycenters = new Map<string, number>();
      for (const id of nodes) {
        const positions: number[] = [];
        for (const source of sourcesOf.get(id) ?? []) {
          const at = prev.get(source);
          if (at !== undefined) positions.push(at);
        }
        barycenters.set(
          id,
          positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : (startPos.get(id) ?? 0)
        );
      }
      nodes.sort((a, b) => (barycenters.get(a) ?? 0) - (barycenters.get(b) ?? 0));
    }

    const crossings = countCrossings(graph, layerLists);
    if (crossings < bestCrossings) {
      bestCrossings = crossings;
      bestOrdering = layerLists.map((layer) => layer.slice());
      fruitless = 0;
    } else {
      fruitless++;
    }
    if (fruitless >= MAX_FRUITLESS || bestCrossings === 0) break;
  }

  layerLists = bestOrdering;

  const orthoSets = orthogonalSubgraphNodes(graph);
  if (orthoSets.length === 0) return layerLists;

  for (const layer of layerLists) {
    for (const { nodes, reversed } of orthoSets) {
      const inLayer = layer.filter((id) => nodes.has(id));
      if (inLayer.length <= 1) continue;
      const internal = new Set(inLayer);
      const successors = new Map<string, string[]>([...internal].map((id) => [id, []]));
      const inDegree = new Map<string, number>([...internal].map((id) => [id, 0]));
      for (const edge of graph.edges) {
        if (!internal.has(edge.source) || !internal.has(edge.target)) continue;
        (must(successors.get(edge.source))).push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
      }
      const topo = topoOrder(inLayer, successors, inDegree);
      const positions = layer.map((id, i) => (internal.has(id) ? i : -1)).filter((i) => i !== -1);
      if (topo.length === positions.length) {
        const order = reversed ? topo.slice().reverse() : topo;
        positions.forEach((pos, i) => {
          layer[pos] = order[i];
        });
      }
    }
  }

  return layerLists;
}

export function computeGapExpansions(graph: Graph, layerOrder: string[][]): Map<number, number> {
  const nodeLayer = new Map<string, number>();
  const nodePos = new Map<string, number>();
  layerOrder.forEach((nodes, layer) => {
    nodes.forEach((id, pos) => {
      nodeLayer.set(id, layer);
      nodePos.set(id, pos);
    });
  });

  const isMark = (id: string): boolean => {
    const shape = graph.nodes.get(id)?.shape;
    return shape !== undefined && STATE_POINTS.has(shape);
  };
  const diagonals = new Map<number, number>();
  const marksAt = new Map<number, Set<string>>();
  for (const edge of graph.edges) {
    if (isSelfReference(edge)) continue;
    const from = nodeLayer.get(edge.source);
    const to = nodeLayer.get(edge.target);
    if (from === undefined || to === undefined) continue;
    if (from >= to) continue;
    if ((nodePos.get(edge.source) ?? 0) === (nodePos.get(edge.target) ?? 0)) continue;
    for (let gap = Math.min(from, to); gap < Math.max(from, to); gap++) {
      if (isMark(edge.source)) {
        const marks = marksAt.get(gap) ?? new Set<string>();
        marksAt.set(gap, marks);
        if (marks.has(edge.source)) continue;
        marks.add(edge.source);
      }
      diagonals.set(gap, (diagonals.get(gap) ?? 0) + 1);
    }
  }

  for (const { nodes } of orthogonalSubgraphNodes(graph)) {
    for (const edge of graph.edges) {
      if (!nodes.has(edge.source) || !nodes.has(edge.target)) continue;
      const layer = nodeLayer.get(edge.source);
      if (layer === undefined || layer !== nodeLayer.get(edge.target)) continue;
      if (Math.abs((nodePos.get(edge.source) ?? 0) - (nodePos.get(edge.target) ?? 0)) < 2) continue;
      diagonals.set(layer, (diagonals.get(layer) ?? 0) + 1);
    }
  }

  const expansions = new Map<number, number>();
  for (const [gap, n] of diagonals) expansions.set(gap, Math.max(0, n - 1));
  return expansions;
}
