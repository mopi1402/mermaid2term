import { isSelfReference, type Graph } from "./model.js";
import { widestLabelLine } from "../text/labels.js";
import { must, pushInto } from "../must.js";
import { type GridLayout } from "./layout/grid.js";
import { type RoutedEdge } from "./routing/routed.js";

// The cells from a box's wall to a loop's first turn down the page, where a lone loop turns in a gap left alone.
export const LOOP_TURN = 5;

// Where one self loop stands among the loops of its box: the loops nest, each one past the one before it.
export interface LoopNest {
  readonly rank: number;
  readonly count: number;
  // The columns its turn stands past the first loop's turn: every loop before it and that loop's label beside it.
  readonly reach: number;
}

// The cells a loop takes past its turn before the next one may turn: its label and a blank either side, or a blank.
export const stepPast = (label: string): number => (label === "" ? 0 : widestLabelLine(label) + 1) + 2;

// Each self loop's nest, keyed by its edge index, in the order the loops are written.
export function loopNests(graph: Graph): Map<number, LoopNest> {
  const byBox = new Map<string, number[]>();
  graph.edges.forEach((edge, index) => {
    if (isSelfReference(edge)) pushInto(byBox, edge.source, index);
  });
  const nests = new Map<number, LoopNest>();
  for (const indices of byBox.values()) {
    let reach = 0;
    indices.forEach((index, rank) => {
      nests.set(index, { rank, count: indices.length, reach });
      reach += stepPast(graph.edges[index].label);
    });
  }
  return nests;
}

// A run meeting the box's wall over a lone loop's return and running past its turn would cut the loop's way down.
function cutsLoop(loop: RoutedEdge, routed: readonly RoutedEdge[], wall: number): boolean {
  const [turn, back] = loop.drawPath[3];
  return routed.some((re) => {
    if (re === loop) return false;
    const path = re.drawPath;
    return [0, path.length - 1].some((end) => {
      const next = end === 0 ? path[1] : path[end - 1];
      const [x, y] = path[end];
      return x === wall && y < back && next !== undefined && next[1] === y && next[0] > turn;
    });
  });
}

// Once every run is laid, the loops nested round one box come back on the rows of its wall no other run meets, the
// first one highest, so each one's return stays under the one inside it; a lone loop does so only when a run cuts it.
export function seatNestedLoops(routed: readonly RoutedEdge[], layout: GridLayout, nests: ReadonlyMap<number, LoopNest>): void {
  const byBox = new Map<string, RoutedEdge[]>();
  for (const re of routed) {
    const nest = nests.get(re.index);
    if (nest === undefined) continue;
    const box = layout.placements.get(re.edge.source);
    if (nest.count < 2 && (box === undefined || !cutsLoop(re, routed, box.drawX + box.drawWidth - 1))) continue;
    byBox.set(re.edge.source, [...(byBox.get(re.edge.source) ?? []), re]);
  }
  for (const [id, loops] of byBox) {
    const box = layout.placements.get(id);
    if (box === undefined) continue;
    const wall = box.drawX + box.drawWidth - 1;
    const taken = new Set<number>();
    for (const re of routed) {
      if (loops.includes(re)) continue;
      for (const [x, y] of [re.drawPath[0], re.drawPath[re.drawPath.length - 1]]) if (x === wall) taken.add(y);
    }
    const top = box.drawY + 1;
    if (top + loops.length > box.drawY + box.drawHeight - 1) continue;
    [...loops]
      .sort((a, b) => must(nests.get(a.index)).rank - must(nests.get(b.index)).rank)
      .forEach((re, k) => {
        re.drawPath[3][1] = top + k;
        re.drawPath[4][1] = top + k;
      });
    // A run meeting that wall on a row the nest takes sinks under it, as far as both its ends allow.
    let below = top + loops.length;
    for (const re of routed) {
      if (loops.includes(re)) continue;
      for (const atEnd of [false, true]) {
        const path = re.drawPath;
        const [end, next] = atEnd ? [path.length - 1, path.length - 2] : [0, 1];
        const [x, y] = path[end];
        if (x !== wall || y >= below || next < 0 || path[next][1] !== y) continue;
        const straight = path.length === 2;
        const far = straight ? layout.placements.get(atEnd ? re.edge.source : re.edge.target) : undefined;
        if (straight && (far === undefined || below > far.drawY + far.drawHeight - 2)) continue;
        if (below > box.drawY + box.drawHeight - 2) continue;
        path[end][1] = below;
        path[next][1] = below;
        below += 1;
      }
    }
  }
}
