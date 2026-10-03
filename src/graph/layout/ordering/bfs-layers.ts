import { must } from "../../../must.js";

export type Endpoints = readonly [string, string];

export interface Spanning {
  // Layer 0 of each family: the roots, then the first node of every family no root reaches.
  readonly seeds: string[];
  readonly treeEdges: Endpoints[];
  // Every node in the order the breadth-first walk met it.
  readonly visits: string[];
}

// The breadth-first spanning tree over `pairs` (no self pair, both ends in `order`), walked from `roots` and
// restarted at every node of `order` not yet met.
export function spanningTree(order: readonly string[], pairs: readonly Endpoints[], roots: readonly string[]): Spanning {
  const seeds: string[] = [...roots];
  const kin = new Map<string, string[]>();
  const link = (from: string, to: string): void => {
    const list = kin.get(from) ?? [];
    list.push(to);
    kin.set(from, list);
  };
  for (const [source, target] of pairs) {
    link(source, target);
    link(target, source);
  }
  const known = new Set<string>();
  const spread = (from: string): void => {
    const stack = [from];
    for (let at = stack.pop(); at !== undefined; at = stack.pop()) {
      if (known.has(at)) continue;
      known.add(at);
      for (const next of kin.get(at) ?? []) stack.push(next);
    }
  };
  for (const root of roots) spread(root);
  for (const id of order) {
    if (known.has(id)) continue;
    seeds.push(id);
    spread(id);
  }

  const childrenOf = new Map<string, string[]>();
  for (const [source, target] of pairs) {
    const held = childrenOf.get(source);
    if (held === undefined) childrenOf.set(source, [target]);
    else if (!held.includes(target)) held.push(target);
  }

  const treeEdges: Endpoints[] = [];
  const visited = new Set<string>();
  // Walked through a HEAD index and never `shift`, which moves every element left on each pop and made this
  // quadratic in the node count on its own.
  const queue: string[] = [];
  let head = 0;
  for (const root of roots) {
    if (visited.has(root)) continue;
    visited.add(root);
    queue.push(root);
  }
  const walk = (): void => {
    while (head < queue.length) {
      const node = must(queue[head]);
      head += 1;
      for (const child of childrenOf.get(node) ?? []) {
        if (visited.has(child)) continue;
        visited.add(child);
        treeEdges.push([node, child]);
        queue.push(child);
      }
    }
  };
  walk();
  for (const id of order) {
    if (visited.has(id)) continue;
    visited.add(id);
    queue.push(id);
    walk();
  }
  return { seeds, treeEdges, visits: queue };
}

// Pushes each tree edge's target at least `step` layers past its source, until nothing moves or `rounds` run out.
export function relaxTree(
  layers: Map<string, number>,
  treeEdges: readonly Endpoints[],
  step: (source: string, target: string) => number,
  rounds: number,
  skip: ReadonlySet<string> | undefined
): void {
  let changed = true;
  for (let round = 0; changed && round < rounds; round++) {
    changed = false;
    for (const [src, tgt] of treeEdges) {
      const from = layers.get(src);
      if (from === undefined) continue;
      if (skip !== undefined && skip.has(tgt)) continue;
      const candidate = from + step(src, tgt);
      const current = layers.get(tgt);
      if (current === undefined || current < candidate) {
        layers.set(tgt, candidate);
        changed = true;
      }
    }
  }
}

// The graph engine's ranking for a plain family of names: breadth-first tree depth, a family with no root ranked
// from layer 0 beside the others. Each layer keeps the order the walk met its names.
export function bfsLayers(names: readonly string[], pairs: readonly Endpoints[]): string[][] {
  if (names.length === 0) return [];
  const present = new Set(names);
  const kept = pairs.filter(([source, target]) => source !== target && present.has(source) && present.has(target));
  const targets = new Set(kept.map(([, target]) => target));
  const rootless = names.filter((name) => !targets.has(name));
  const { seeds, treeEdges, visits } = spanningTree(names, kept, rootless.length > 0 ? rootless : [names[0]]);
  const layerOf = new Map<string, number>(seeds.map((seed) => [seed, 0]));
  relaxTree(layerOf, treeEdges, () => 1, names.length * 2, undefined);
  const layers: string[][] = [];
  for (const name of visits) {
    const at = layerOf.get(name) ?? 0;
    while (layers.length <= at) layers.push([]);
    layers[at].push(name);
  }
  return layers.filter((layer) => layer.length > 0);
}
