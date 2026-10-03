import { type Graph, type Subgraph } from "../../model.js";
import { boxesUnder, everySubgraph, membersOf } from "../../subgraph-tree.js";

// The order mermaid hands its nodes to dagre: every subgraph first, the last one closed first, then the vertices as
// declared. A subgraph no link leaves is laid out apart and stands in as one node where it was handed over, so it
// comes before the vertices of its level; one a link leaves is no node at all, its members taking their own turns.
export function seedOrder(graph: Graph): string[] {
  const closed = graph.subgraphs.flatMap(function closing(sg: Subgraph): Subgraph[] {
    return [...sg.children.flatMap(closing), sg];
  });
  const handed = new Map(closed.reverse().map((sg, at) => [sg, at]));
  const alone = new Set(
    // A composite state is handed over as the state diagram meets it, never ahead of its level's states.
    everySubgraph(graph).filter((sg) => {
      if (sg.composite || sg.concurrent) return false;
      // A link may name a subgraph itself, which stands inside it as its members do.
      const inside = new Set([...membersOf(sg), ...boxesUnder(sg).map((box) => box.id)]);
      return graph.edges.every((edge) => inside.has(edge.source) === inside.has(edge.target));
    })
  );
  const declared = new Map(graph.nodeOrder.map((id, at) => [id, at]));
  const keyOf = (id: string): number[] => {
    const chain: Subgraph[] = [];
    for (let sg = graph.findSubgraphForNode(id); sg !== undefined; sg = sg.parent) chain.unshift(sg);
    return [...chain.filter((sg) => alone.has(sg)).flatMap((sg) => [0, handed.get(sg) ?? 0]), 1, declared.get(id) ?? 0];
  };
  const keys = new Map(graph.nodeOrder.map((id) => [id, keyOf(id)]));
  const compare = (a: readonly number[], b: readonly number[]): number => {
    for (let at = 0; at < Math.min(a.length, b.length); at++) if (a[at] !== b[at]) return a[at] - b[at];
    return a.length - b.length;
  };
  return [...graph.nodeOrder].sort((a, b) => compare(keys.get(a) ?? [], keys.get(b) ?? []));
}
