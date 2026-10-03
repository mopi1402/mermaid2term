import { cellId } from "./pathfinder.js";
import { type Kin } from "./lanes.js";
import { markPaths, type RoutedEdge } from "./routed.js";

// What a move among the runs may not make worse: runs crossed, cells two runs share or a run passes another's head
// on, runs of strangers laid side by side, and cells of a box or a frame's rule a run passes over.
export interface Tally {
  crossings: number;
  overlaps: number;
  glued: number;
  solid: number;
}

// Runs out of the same box, or into it, leave or meet it side by side: a sheaf, never two runs laid against each other.
const shareABox: Kin = (a, b) => [a.source, a.target].some((id) => id === b.source || id === b.target);

export function tally(routed: readonly RoutedEdge[], solid: ReadonlySet<string>, kin: Kin = shareABox): Tally {
  const marks = markPaths([...routed]);
  const t: Tally = { crossings: 0, overlaps: 0, glued: 0, solid: 0 };
  for (const held of [marks.corners, marks.ends]) for (const ones of held.values()) t.overlaps += ones.size - 1;
  for (const [cell, passing] of marks.passes) {
    const entries = [...passing];
    entries.forEach(([one, alongRow], i) => {
      for (const [other, otherRow] of entries.slice(i + 1)) {
        if (other === one) continue;
        if (alongRow === otherRow) t.overlaps++;
        else t.crossings++;
      }
      for (const held of [marks.corners.get(cell), marks.ends.get(cell)]) if (held !== undefined && [...held].some((o) => o !== one)) t.overlaps++;
    });
    if (solid.has(cell)) t.solid++;
  }
  // The cell a run's head stands on is its own: another run passing there runs through the head.
  routed.forEach((re, index) => {
    const path = re.drawPath;
    if (path.length < 2) return;
    for (const [end, next] of [[path[0], path[1]], [path[path.length - 1], path[path.length - 2]]]) {
      const head = cellId(end[0] + Math.sign(next[0] - end[0]), end[1] + Math.sign(next[1] - end[1]));
      const passing = marks.passes.get(head);
      if (passing !== undefined && [...passing].some(([one]) => one !== index)) t.overlaps++;
    }
  });
  routed.forEach((re, index) => {
    const path = re.drawPath;
    for (let k = 0; k + 1 < path.length; k++) {
      const [[x1, y1], [x2, y2]] = [path[k], path[k + 1]];
      const alongRow = y1 === y2;
      const [from, to] = alongRow ? [x1, x2] : [y1, y2];
      const step = Math.sign(to - from);
      for (let a = from + step; step !== 0 && a !== to; a += step) {
        const beside = alongRow ? cellId(a, y1 + 1) : cellId(x1 + 1, a);
        const passing = marks.passes.get(beside);
        if (passing !== undefined && [...passing].some(([one, row]) => one !== index && row === alongRow && !kin(routed[one].edge, re.edge))) t.glued++;
      }
    }
  });
  return t;
}

export const notWorse = (after: Tally, before: Tally): boolean =>
  after.crossings <= before.crossings && after.overlaps <= before.overlaps && after.glued <= before.glued && after.solid <= before.solid;
