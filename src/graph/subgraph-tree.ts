import type { Graph, Subgraph } from "./model.js";

export function boxesUnder(sg: Subgraph): Subgraph[] {
  const all: Subgraph[] = [sg];
  for (const child of sg.children) all.push(...boxesUnder(child));
  return all;
}

export function everySubgraph(graph: Graph): Subgraph[] {
  return graph.subgraphs.flatMap(boxesUnder);
}

export function membersOf(sg: Subgraph): Set<string> {
  const all = new Set<string>();
  for (const box of boxesUnder(sg)) for (const id of box.nodeIds) all.add(id);
  return all;
}

export function chainOf(graph: Graph, nodeId: string): Set<string> {
  const chain = new Set<string>();
  let sg = graph.findSubgraphForNode(nodeId);
  while (sg !== undefined) {
    chain.add(sg.id);
    sg = sg.parent;
  }
  return chain;
}
