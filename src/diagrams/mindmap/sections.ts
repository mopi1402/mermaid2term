import { EDGE, SECTION_PREFIX, SECTION_ROOT, elementKey, indexed, sectionForeground } from "../../canvas/keys.js";
import { SECTION_SEATS } from "../../paint/theme-model.js";
import { type MindmapNode } from "./model.js";

// A node and the `cScale` seat its section paints it with, `undefined` for the root.
export interface Branch {
  readonly node: MindmapNode;
  readonly seat: number | undefined;
}

// `assignSections`: the root's child `i` opens `section-(i % 11)`, which `genSections` fills with `cScale(i % 11 + 1)`.
const branchSeat = (index: number): number => (index % (SECTION_SEATS - 1)) + 1;

// The seats a cycle of `SECTION_SEATS - 1` colours has to give.
const SEATS = SECTION_SEATS - 1;

// Past eleven branches a colour comes back. The branches sharing one are then those facing each other across the
// root, `round` naming them clockwise, the others seated in source order as `assignSections` seats them.
export function spreadSeats(sources: readonly Branch[], round: readonly Branch[]): Map<MindmapNode, number> {
  const n = sources.length;
  const seats = new Map<MindmapNode, number>();
  if (n <= SEATS || n > 2 * SEATS) {
    for (const branch of sources) if (branch.seat !== undefined) seats.set(branch.node, branch.seat);
    return seats;
  }
  const half = Math.floor(n / 2);
  const repeats = n - SEATS;
  const mate = new Map<MindmapNode, MindmapNode>();
  for (let m = 0; m < repeats; m++) {
    const at = Math.floor((m * half) / repeats);
    mate.set(round[at].node, round[at + half].node);
    mate.set(round[at + half].node, round[at].node);
  }
  let next = 0;
  for (const branch of sources) {
    const faced = mate.get(branch.node);
    seats.set(branch.node, (faced === undefined ? undefined : seats.get(faced)) ?? branchSeat(next++));
  }
  return seats;
}

export const branchesOf = (branch: Branch): Branch[] =>
  branch.node.children.map((node, at) => ({ node, seat: branch.seat ?? branchSeat(at) }));

export const nodeKey = ({ node, seat }: Branch): string => elementKey(seat === undefined ? SECTION_ROOT : indexed(SECTION_PREFIX, seat), node.element);

// `.section-edge-N` strokes an edge in its child's `cScale`; a trunk several sections share has none of its own.
export const edgeKey = (seat: number | undefined): string => (seat === undefined ? EDGE : sectionForeground(seat));

export const trunkKey = (branches: readonly Branch[]): string => {
  const seats = new Set(branches.map((branch) => branch.seat));
  const [only] = seats;
  return seats.size === 1 ? edgeKey(only) : EDGE;
};
