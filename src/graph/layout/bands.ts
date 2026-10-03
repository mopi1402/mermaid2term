import { type Graph } from "../model.js";
import { STRIDE } from "./grid.js";
import { membersOf } from "../subgraph-tree.js";
import { widenSpan } from "./spans.js";

export function subgraphsSharingALayer(
  chains: Map<string, Set<string>>,
  layerOf: Map<string, number>
): Set<string> {
  const spans = new Map<string, [number, number]>();
  const nodesIn = new Map<string, Set<string>>();
  for (const [id, chain] of chains) {
    for (const sg of chain) {
      const members = nodesIn.get(sg);
      if (members === undefined) nodesIn.set(sg, new Set([id]));
      else members.add(id);
      const layer = layerOf.get(id);
      if (layer !== undefined) widenSpan(spans, sg, layer);
    }
  }

  const within = (inner: string, outer: string): boolean =>
    [...(nodesIn.get(inner) ?? [])].every((id) => (nodesIn.get(outer) ?? new Set<string>()).has(id));
  const beside = new Set<string>();
  for (const [sg, span] of spans) {
    for (const [other, otherSpan] of spans) {
      if (sg === other || within(sg, other) || within(other, sg)) continue;
      if (span[0] <= otherSpan[1] && otherSpan[0] <= span[1]) beside.add(sg);
    }
    const members = nodesIn.get(sg) ?? new Set<string>();
    for (const [id, layer] of layerOf) if (layer >= span[0] && layer <= span[1] && !members.has(id)) beside.add(sg);
  }
  return beside;
}

interface Band {
  id: string;
  members: string[];
  low: number;
  high: number;
  near: number;
  far: number;
}

export function separateBands(
  graph: Graph,
  layerOf: Map<string, number>,
  coordOf: (id: string) => number,
  setCoord: (id: string, value: number) => void
): void {
  if (graph.subgraphs.length === 0) return;

  const outermost = new Map<string, string>();
  for (const sg of graph.subgraphs) if (sg.parent === undefined) for (const id of membersOf(sg)) outermost.set(id, sg.id);

  const bands = new Map<string, Band>();
  for (const [id, layer] of layerOf) {
    const owner = outermost.get(id);
    const key = owner === undefined ? `node:${id}` : `box:${owner}`;
    const at = coordOf(id);
    const band = bands.get(key);
    if (band === undefined) {
      bands.set(key, { id: key, members: [id], low: layer, high: layer, near: at, far: at });
      continue;
    }
    band.members.push(id);
    band.low = Math.min(band.low, layer);
    band.high = Math.max(band.high, layer);
    band.near = Math.min(band.near, at);
    band.far = Math.max(band.far, at);
  }

  const order = [...bands.values()].sort((a, b) => a.near - b.near || a.low - b.low || (a.id < b.id ? -1 : 1));
  const settled: Band[] = [];
  for (const band of order) {
    let shift = 0;
    for (const other of settled) {
      if (band.low > other.high || other.low > band.high) continue;
      if (band.near + shift > other.far) continue;
      shift = Math.max(shift, other.far + STRIDE - band.near);
    }
    if (shift !== 0) for (const id of band.members) setCoord(id, coordOf(id) + shift);
    band.near += shift;
    band.far += shift;
    settled.push(band);
  }
}
