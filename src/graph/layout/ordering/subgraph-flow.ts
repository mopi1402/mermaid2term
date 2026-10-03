import { isReversed, isSelfReference, isVertical, makeEdge, normalized, type Edge, type Graph, type Subgraph } from "../../model.js";
import { must } from "../../../must.js";
import { everySubgraph, membersOf } from "../../subgraph-tree.js";

export function orderedByOneParent(graph: Graph, source: string, target: string): boolean {
  const parent = graph.findSubgraphById(source)?.parent ?? undefined;
  if (parent === undefined || parent !== (graph.findSubgraphById(target)?.parent ?? undefined)) return false;
  if (parent.direction === undefined) return false;
  return isVertical(normalized(parent.direction)) !== isVertical(normalized(graph.direction));
}

const nestedIn = (sg: Subgraph, owner: Subgraph): boolean => {
  for (let at = sg.parent; at !== undefined; at = at.parent) if (at === owner) return true;
  return false;
};

// A virtual run and the boxes its ends were drawn out of, undefined on an end that was a node already.
export interface SubgraphRun {
  edge: Edge;
  sourceBox: Subgraph | undefined;
  targetBox: Subgraph | undefined;
}

export const expandSubgraphEdges = (graph: Graph): Edge[] => subgraphRuns(graph).map((run) => run.edge);

export function subgraphRuns(graph: Graph): SubgraphRun[] {
  const acrossTheFlow = (e: Edge): boolean => e.sourceIsSubgraph && e.targetIsSubgraph && orderedByOneParent(graph, e.source, e.target);
  // A run into or out of a box nested in the owner counts as well: the state it enters is no root of the owner.
  const fringe = (owner: Subgraph, roots: boolean): Set<string> => {
    const all = membersOf(owner);
    const ends = (id: string, isSubgraph: boolean): Set<string> | undefined => {
      if (!isSubgraph) return all.has(id) ? new Set([id]) : undefined;
      const sg = graph.findSubgraphById(id);
      return sg !== undefined && nestedIn(sg, owner) ? membersOf(sg) : undefined;
    };
    const reached = new Set<string>();
    for (const e of graph.edges) {
      if (isSelfReference(e) || acrossTheFlow(e)) continue;
      const from = ends(e.source, e.sourceIsSubgraph);
      const to = ends(e.target, e.targetIsSubgraph);
      if (from === undefined || to === undefined) continue;
      for (const id of roots ? to : from) reached.add(id);
    }
    const kept = new Set([...all].filter((id) => !reached.has(id)));
    return kept.size > 0 ? kept : all;
  };

  const virtual: SubgraphRun[] = [];
  for (const e of graph.edges) {
    if ((!e.sourceIsSubgraph && !e.targetIsSubgraph) || acrossTheFlow(e)) continue;
    const sources = new Set<string>();
    const targets = new Set<string>();
    for (const [endpoint, isSubgraph, bucket, roots] of [
      [e.source, e.sourceIsSubgraph, sources, false],
      [e.target, e.targetIsSubgraph, targets, true],
    ] satisfies Array<[string, boolean, Set<string>, boolean]>) {
      if (!isSubgraph) {
        bucket.add(endpoint);
        continue;
      }
      const sg = graph.findSubgraphById(endpoint);
      if (sg === undefined) continue;
      for (const id of fringe(sg, roots)) bucket.add(id);
    }
    const shared = [...sources].some((s) => targets.has(s));
    if (sources.size === 0 || targets.size === 0 || shared) continue;
    const sourceBox = e.sourceIsSubgraph ? graph.findSubgraphById(e.source) : undefined;
    const targetBox = e.targetIsSubgraph ? graph.findSubgraphById(e.target) : undefined;
    for (const s of sources) {
      for (const t of targets) virtual.push({ edge: makeEdge(s, t, { minLength: e.minLength }), sourceBox, targetBox });
    }
  }
  return virtual;
}

interface OrthogonalSet {
  nodes: Set<string>;
  reversed: boolean;
}

export const crossesTheFlow = (sg: Subgraph, graph: Graph): boolean =>
  sg.direction !== undefined && isVertical(normalized(sg.direction)) !== isVertical(normalized(graph.direction));

export function orthogonalSubgraphNodes(graph: Graph): OrthogonalSet[] {
  const result: OrthogonalSet[] = [];
  for (const sg of everySubgraph(graph)) {
    if (crossesTheFlow(sg, graph)) result.push({ nodes: new Set(sg.nodeIds), reversed: isReversed(must(sg.direction)) });
  }
  return result;
}

export function reverseAlongSubgraphs(graph: Graph, layers: Map<string, number>): Map<string, number> {
  const mirrored = alongReversedSubgraphs(graph);
  if (mirrored.length === 0) return layers;
  const next = new Map(layers);
  for (const sg of mirrored) {
    const present = [...membersOf(sg)].filter((id) => next.has(id));
    if (present.length < 2) continue;
    const values = present.map((id) => must(next.get(id)));
    const low = Math.min(...values);
    const high = Math.max(...values);
    for (const id of present) next.set(id, low + high - (must(next.get(id))));
  }
  return next;
}

export function alongReversedNodes(graph: Graph): Array<Set<string>> {
  return alongReversedSubgraphs(graph).map(membersOf);
}

function alongReversedSubgraphs(graph: Graph): Subgraph[] {
  if (graph.subgraphs.length === 0) return [];
  const hit: Subgraph[] = [];
  const walk = (subs: Subgraph[], flipped: boolean): void => {
    for (const sg of subs) {
      let sense = flipped;
      if (sg.direction !== undefined && !crossesTheFlow(sg, graph)) {
        sense = isReversed(sg.direction);
        if (sense !== flipped) hit.push(sg);
      }
      walk(sg.children, sense);
    }
  };
  walk(graph.subgraphs, false);
  return hit;
}
