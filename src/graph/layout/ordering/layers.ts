import { type Graph } from "../../model.js";
import { NodeShape } from "../../shapes.js";
import { must } from "../../../must.js";
import { orthogonalSubgraphNodes } from "./subgraph-flow.js";
import { relaxTree, spanningTree, type Endpoints } from "./bfs-layers.js";

const ONE_LAYER = 1;

type ByEndpoints<T> = Map<string, Map<string, T>>;

function put<T>(into: ByEndpoints<T>, source: string, target: string, value: T): void {
  const row = into.get(source);
  if (row === undefined) into.set(source, new Map([[target, value]]));
  else row.set(target, value);
}

export function assignLayers(graph: Graph): Map<string, number> {
  const layers = sinkEndsLast(graph, layerTree(graph));
  return layers;
}

function sinkEndsLast(graph: Graph, layers: Map<string, number>): Map<string, number> {
  for (const [id, node] of graph.nodes) {
    if (node.shape !== NodeShape.END_STATE) continue;
    const parents = graph.edges
      .filter((e) => e.target === id && e.source !== id && layers.has(e.source))
      .map((e) => (must(layers.get(e.source))) + Math.max(ONE_LAYER, e.minLength));
    if (parents.length > 0) layers.set(id, Math.max(...parents));
  }
  return layers;
}

function layerTree(graph: Graph): Map<string, number> {
  const layers = new Map<string, number>();
  const pairs: Endpoints[] = graph.edges
    .filter((e) => e.source !== e.target && graph.nodes.has(e.source) && graph.nodes.has(e.target))
    .map((e) => [e.source, e.target]);
  const { seeds, treeEdges } = spanningTree(graph.nodeOrder, pairs, graph.getRoots());
  for (const seed of seeds) if (!layers.has(seed)) layers.set(seed, 0);

  const minLengths: ByEndpoints<number> = new Map();
  const minLengthOf = (source: string, target: string): number =>
    minLengths.get(source)?.get(target) ?? ONE_LAYER;
  for (const e of graph.edges) put(minLengths, e.source, e.target, Math.max(minLengthOf(e.source, e.target), e.minLength));

  const orthoSets = orthogonalSubgraphNodes(graph);
  const orthoOf = new Map<string, number>();
  orthoSets.forEach((set, i) => {
    for (const id of set.nodes) orthoOf.set(id, i);
  });
  const flat = (source: string, target: string): boolean =>
    orthoOf.has(source) && orthoOf.get(source) === orthoOf.get(target);

  const relax = (skip: Set<string> | undefined): void =>
    relaxTree(layers, treeEdges, (src, tgt) => (flat(src, tgt) ? 0 : minLengthOf(src, tgt)), graph.nodeOrder.length * 2, skip);

  relax(undefined);
  for (const id of graph.nodeOrder) if (!layers.has(id)) layers.set(id, 0);

  if (orthoSets.length === 0) return layers;

  for (const { nodes } of orthoSets) {
    const present = [...nodes].filter((id) => layers.has(id));
    if (present.length === 0) continue;
    const min = Math.min(...present.map((id) => must(layers.get(id))));
    for (const id of present) layers.set(id, min);
  }

  const allOrtho = new Set<string>();
  for (const set of orthoSets) for (const id of set.nodes) allOrtho.add(id);
  for (const id of graph.nodeOrder) if (!allOrtho.has(id)) layers.delete(id);
  for (const seed of seeds) if (!layers.has(seed)) layers.set(seed, 0);
  relax(allOrtho);
  for (const id of graph.nodeOrder) if (!layers.has(id)) layers.set(id, 0);

  return layers;
}
