import { isSelfReference, rootsAmong, type Graph } from "../../model.js";
import { must } from "../../../must.js";
import { topoOrder } from "../../topo.js";
import { crossesTheFlow, orderedByOneParent } from "./subgraph-flow.js";
import { everySubgraph } from "../../subgraph-tree.js";
import { widenSpan } from "../spans.js";

export function separateSubgraphLayers(graph: Graph, layers: Map<string, number>): Map<string, number> {
  if (graph.subgraphs.length === 0) return layers;

  const named = new Set<string>();
  for (const e of graph.edges) {
    if (e.sourceIsSubgraph && e.targetIsSubgraph && orderedByOneParent(graph, e.source, e.target)) continue;
    if (e.sourceIsSubgraph) named.add(e.source);
    if (e.targetIsSubgraph) named.add(e.target);
  }
  if (named.size < 2) return layers;

  const nodeSg = new Map<string, string>();
  for (const sg of everySubgraph(graph).reverse()) {
    if (!named.has(sg.id)) continue;
    for (const id of sg.nodeIds) nodeSg.set(id, sg.id);
  }

  const ranges = new Map<string, [number, number]>();
  for (const [id, layer] of layers) {
    const sgId = nodeSg.get(id);
    if (sgId !== undefined) widenSpan(ranges, sgId, layer);
  }
  if (ranges.size < 2) return layers;

  const every = [...ranges.keys()];
  const succs = new Map<string, Set<string>>(every.map((id) => [id, new Set<string>()]));
  const inDegree = new Map<string, number>(every.map((id) => [id, 0]));
  for (const e of graph.edges) {
    const from = nodeSg.get(e.source);
    const to = nodeSg.get(e.target);
    if (from === undefined || to === undefined || from === to) continue;
    const bucket = succs.get(from);
    if (bucket === undefined || bucket.has(to)) continue;
    bucket.add(to);
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  }

  const sgIds = every.filter((id) => (inDegree.get(id) ?? 0) > 0 || (succs.get(id)?.size ?? 0) > 0);
  if (sgIds.length < 2) return layers;
  for (const [id, sgId] of [...nodeSg]) if (!sgIds.includes(sgId)) nodeSg.delete(id);
  for (const id of every) {
    if (sgIds.includes(id)) continue;
    succs.delete(id);
    inDegree.delete(id);
  }

  let overlap = false;
  for (let i = 0; i < sgIds.length && !overlap; i++) {
    for (let j = i + 1; j < sgIds.length; j++) {
      const a = must(ranges.get(sgIds[i]));
      const b = must(ranges.get(sgIds[j]));
      if (a[0] <= b[1] && b[0] <= a[1]) {
        overlap = true;
        break;
      }
    }
  }
  if (!overlap) return layers;

  const topo = topoOrder(sgIds, succs, inDegree);
  if (topo.length !== sgIds.length) return layers;

  const internals = new Map<string, Map<string, number>>();
  const sizes = new Map<string, number>();
  const flat = new Set<string>();
  for (const sg of everySubgraph(graph)) if (crossesTheFlow(sg, graph)) flat.add(sg.id);
  for (const sgId of topo) {
    const nodes = new Set([...nodeSg].filter(([, id]) => id === sgId).map(([nid]) => nid));
    if (flat.has(sgId)) {
      internals.set(sgId, new Map([...nodes].map((id) => [id, 0])));
      sizes.set(sgId, nodes.size > 0 ? 1 : 0);
      continue;
    }
    const edges = graph.edges.filter((e) => nodes.has(e.source) && nodes.has(e.target) && !isSelfReference(e));
    let roots = rootsAmong(nodes, edges);
    if (roots.length === 0) roots = [...nodes].slice(0, 1);

    const internal = new Map<string, number>(roots.map((id) => [id, 0]));
    let changed = true;
    for (let i = 0; i < nodes.size * 2 + 1 && changed; i++) {
      changed = false;
      for (const e of edges) {
        const from = internal.get(e.source);
        if (from === undefined) continue;
        const current = internal.get(e.target);
        if (current === undefined || current < from + 1) {
          internal.set(e.target, from + 1);
          changed = true;
        }
      }
    }
    for (const id of nodes) if (!internal.has(id)) internal.set(id, 0);
    internals.set(sgId, internal);
    sizes.set(sgId, internal.size > 0 ? Math.max(...internal.values()) + 1 : 0);
  }

  const outside = [...layers].filter(([id]) => !nodeSg.has(id)).map(([, layer]) => layer);
  const firstMin = topo.length > 0 ? (must(ranges.get(topo[0])))[0] : 0;
  const above = outside.filter((layer) => layer < firstMin);
  let offset = above.length > 0 ? Math.max(...above) + 1 : 0;

  const offsets = new Map<string, number>();
  for (const sgId of topo) {
    offsets.set(sgId, offset);
    offset += sizes.get(sgId) ?? 0;
  }

  const next = new Map(layers);
  for (const [sgId, internal] of internals) {
    for (const [id, relative] of internal) next.set(id, (offsets.get(sgId) ?? 0) + relative);
  }

  for (const id of graph.nodeOrder) {
    if (nodeSg.has(id)) continue;
    let best = -1;
    for (const e of graph.edges) {
      if (e.target !== id) continue;
      const from = next.get(e.source);
      if (from !== undefined) best = Math.max(best, from);
    }
    if (best >= 0) next.set(id, best + 1);
  }
  return next;
}
