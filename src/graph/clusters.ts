import { makeNode, type Graph, type Subgraph } from "./model.js";
import { NodeShape } from "./shapes.js";
import { NUL } from "../text/chars.js";
import { boxesUnder } from "./subgraph-tree.js";

// The walk `subgraph-tree` makes, over a list of subgraphs rather than a whole graph.
export const everySubgraph = (subgraphs: readonly Subgraph[]): Subgraph[] => subgraphs.flatMap(boxesUnder);

function unregister(subgraphs: readonly Subgraph[], id: string): void {
  for (const sg of subgraphs) {
    const at = sg.nodeIds.indexOf(id);
    if (at !== -1) sg.nodeIds.splice(at, 1);
    unregister(sg.children, id);
  }
}

export function resolveClusterEdges(graph: Graph, kept: ReadonlySet<string> = new Set()): void {
  const ids = new Set(everySubgraph(graph.subgraphs).map((sg) => sg.id));
  if (ids.size === 0) return;

  const taken = new Set<string>();
  for (const edge of graph.edges) {
    if (ids.has(edge.source) && !kept.has(edge.source)) {
      edge.sourceIsSubgraph = true;
      taken.add(edge.source);
    }
    if (ids.has(edge.target) && !kept.has(edge.target)) {
      edge.targetIsSubgraph = true;
      taken.add(edge.target);
    }
  }
  for (const id of taken) removeNode(graph, id);
  holdEmptyClusters(graph);
}

// mermaid draws a cluster with nothing in it as an empty frame; a blank of text inside holds its room in the layout.
function holdEmptyClusters(graph: Graph): void {
  for (const sg of everySubgraph(graph.subgraphs)) {
    if (sg.nodeIds.length > 0 || sg.children.length > 0 || graph.nodes.has(sg.id)) continue;
    const id = `${NUL}empty:${sg.id}`;
    graph.addNode(makeNode(id, "", { shape: NodeShape.TEXT }));
    sg.nodeIds.push(id);
  }
}

export function removeNode(graph: Graph, id: string): void {
  graph.nodes.delete(id);
  const at = graph.nodeOrder.indexOf(id);
  if (at !== -1) graph.nodeOrder.splice(at, 1);
  unregister(graph.subgraphs, id);
}
