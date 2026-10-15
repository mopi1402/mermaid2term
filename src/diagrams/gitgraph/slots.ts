import type { GitGraph } from "./model.js";

// A slot is the step along the graph a commit stands on: one per commit, or with `parallelCommits` one past its
// furthest parent, so commits on separate branches share a step (`calculatePosition`, 11.17.0).
export function slotsOf(diagram: GitGraph): Map<string, number> {
  const slots = new Map<string, number>();
  diagram.commits.forEach((commit, i) => {
    if (!diagram.parallelCommits) {
      slots.set(commit.key, i);
      return;
    }
    const parents = commit.parents.map((key) => slots.get(key)).filter((slot) => slot !== undefined);
    slots.set(commit.key, parents.length === 0 ? 0 : Math.max(...parents) + 1);
  });
  return slots;
}

export const slotCount = (slots: ReadonlyMap<string, number>): number => Math.max(-1, ...slots.values()) + 1;
