import { cellId } from "../../canvas/geometry.js";
import { Direction, makeEdge, makeNode, type Graph, type Subgraph } from "../../graph/model.js";
import { NodeShape } from "../../graph/shapes.js";
import { must } from "../../must.js";
import { NUL } from "../../text/chars.js";
import { removeNode } from "../../graph/clusters.js";
import { everySubgraph, membersOf } from "../../graph/subgraph-tree.js";
import { SIDES, type ArchitectureModel, type Hint, type Seat, type Side } from "./model.js";

const OPPOSITE: Readonly<Record<Side, Side>> = { L: "R", R: "L", T: "B", B: "T" };
const SIDE_OFFSET: Readonly<Record<Side, readonly [number, number]>> = {
  R: [1, 0],
  L: [-1, 0],
  B: [0, 1],
  T: [0, -1],
};
const DEFAULT_OFFSET: readonly [number, number] = [1, 0];

// One arm of a junction: the node it reaches, the junction's side it leaves by, and whether that node's end has a head.
interface Branch {
  readonly node: string;
  readonly side: Side;
  readonly head: boolean;
}

// The grid every node is seated on, from the sides the edges and `align` lines name, junctions folded into runs.
export function layOutArchitecture({ graph, groups, hints, aligned, nodeIds, junctionIds }: ArchitectureModel): Graph {
  holdEmptyGroups(graph, groups, nodeIds);

  const seats: Seat[] = [
    ...hints.map((h): Seat => [h.source, h.sourceSide, h.target]),
    ...aligned.filter(([source, , target]) => graph.nodes.has(source) && graph.nodes.has(target)),
  ];
  if (seats.length === 0) return graph;

  const positions = gridPositions(nodeIds, seats, everySubgraph(graph));
  const folded = new Set([...junctionIds].filter((id) => balanced(id, hints)));
  if (folded.size > 0) {
    eliminateJunctions(graph, folded, hints);
    for (const id of folded) positions.delete(id);
  }
  applyPositions(graph, positions);

  return graph;
}

// mermaid's `drawGroups` frames every group; a frame with no member holds no cell here, so it is lent a blank one.
function holdEmptyGroups(graph: Graph, groups: ReadonlyMap<string, Subgraph>, nodeIds: string[]): void {
  for (const [id, sg] of groups) {
    if (sg.nodeIds.length > 0 || sg.children.length > 0) continue;
    const hold = `${id}${NUL}`;
    graph.addNode(makeNode(hold, "", { shape: NodeShape.JUNCTION }));
    sg.nodeIds.push(hold);
    nodeIds.push(hold);
  }
}

// A junction folds into direct runs only when every branch has one on the opposite side to pair with, and no head
// written on the junction's own end would be lost with it: mermaid draws that head pointing into the junction.
function balanced(id: string, hints: readonly Hint[]): boolean {
  const count = new Map<Side, number>(SIDES.map((side) => [side, 0]));
  for (const h of hints) {
    if ((h.target === id && h.headAtTarget) || (h.source === id && h.headAtSource)) return false;
    if (h.source === id) count.set(h.sourceSide, (count.get(h.sourceSide) ?? 0) + 1);
    if (h.target === id) count.set(h.targetSide, (count.get(h.targetSide) ?? 0) + 1);
  }
  return count.get("L") === count.get("R") && count.get("T") === count.get("B");
}

function eliminateJunctions(graph: Graph, junctions: ReadonlySet<string>, hints: readonly Hint[]): void {
  const neighbours = new Map<string, Branch[]>();
  for (const id of junctions) neighbours.set(id, []);
  for (const h of hints) {
    if (junctions.has(h.source)) must(neighbours.get(h.source)).push({ node: h.target, side: h.sourceSide, head: h.headAtTarget });
    if (junctions.has(h.target)) must(neighbours.get(h.target)).push({ node: h.source, side: h.targetSide, head: h.headAtSource });
  }

  const resolve = (branch: Branch, visited: Set<string>): Branch[] => {
    if (!junctions.has(branch.node)) return [branch];
    if (visited.has(branch.node)) return [];
    visited.add(branch.node);

    const onward = neighbours.get(branch.node) ?? [];
    const found: Branch[] = [];
    for (const next of onward) if (next.side === branch.side) found.push(...resolve(next, visited));
    if (found.length === 0) {
      for (const next of onward) if (!junctions.has(next.node) && !visited.has(next.node)) found.push(next);
    }
    return found;
  };

  const added = new Set<string>();
  const pairs: Array<readonly [Branch, Branch]> = [];

  for (const id of junctions) {
    const real: Branch[] = [];
    for (const branch of neighbours.get(id) ?? []) {
      for (const reached of resolve(branch, new Set([id]))) real.push({ node: reached.node, side: branch.side, head: reached.head });
    }

    const paired = new Set<number>();
    real.forEach((first, i) => {
      if (paired.has(i)) return;
      const opposite = OPPOSITE[first.side];
      for (let j = 0; j < real.length; j++) {
        const second = real[j];
        if (j === i || paired.has(j) || second.side !== opposite) continue;
        const key = first.node < second.node ? `${first.node}${NUL}${second.node}` : `${second.node}${NUL}${first.node}`;
        if (!added.has(key)) {
          added.add(key);
          pairs.push([first, second]);
        }
        paired.add(i);
        paired.add(j);
        break;
      }
    });
  }

  graph.edges = graph.edges.filter((e) => !junctions.has(e.source) && !junctions.has(e.target));
  for (const [source, target] of pairs) {
    graph.addEdge(makeEdge(source.node, target.node, { hasArrowStart: source.head, hasArrowEnd: target.head }));
  }

  for (const id of junctions) removeNode(graph, id);
}

type Cell = readonly [col: number, row: number];

const cellKey = ([col, row]: Cell): string => cellId(col, row);

// Every node reached through the seats from the first one, or from a node already pinned, and the rest on row 0 past them.
function seated(nodeIds: readonly string[], seats: readonly Seat[], pinned: ReadonlyMap<string, Cell>): Map<string, Cell> {
  const positions = new Map<string, Cell>(pinned);
  const first = nodeIds[0];
  if (first !== undefined && !positions.has(first)) positions.set(first, [0, 0]);
  const taken = new Set([...positions.values()].map(cellKey));
  // An `align` member keeps its row or column and steps past a cell another node already holds.
  const land = (id: string, [col, row]: Cell, [dc, dr]: readonly [number, number], loose: boolean): void => {
    let at: Cell = [col, row];
    while (loose && taken.has(cellKey(at))) at = [at[0] + dc, at[1] + dr];
    positions.set(id, at);
    taken.add(cellKey(at));
  };

  for (let pass = 0; pass < nodeIds.length + 1; pass++) {
    let changed = false;
    for (const [source, sourceSide, target, loose = false] of seats) {
      const [dc, dr] = SIDE_OFFSET[sourceSide] ?? DEFAULT_OFFSET;
      const from = positions.get(source);
      const to = positions.get(target);
      if (from !== undefined && to === undefined) {
        land(target, [from[0] + dc, from[1] + dr], [dc, dr], loose);
        changed = true;
      } else if (to !== undefined && from === undefined) {
        land(source, [to[0] - dc, to[1] - dr], [-dc, -dr], loose);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const columns = [...positions.values()].map(([c]) => c);
  let free = (columns.length === 0 ? 0 : Math.max(...columns)) + 1;
  for (const id of nodeIds) {
    if (!positions.has(id)) {
      positions.set(id, [free, 0]);
      free += 1;
    }
  }
  return positions;
}

// The first node standing inside the cells a group's members span without being one of them, the free cell it
// steps out to (onward along the seat that placed it, else across it, never over another node) and the members it
// steps away from, which hold their cells.
function intruder(
  positions: ReadonlyMap<string, Cell>,
  seats: readonly Seat[],
  groups: readonly Subgraph[],
  pinned: ReadonlyMap<string, Cell>
): { readonly id: string; readonly to: Cell; readonly held: ReadonlySet<string> } | undefined {
  const taken = new Set([...positions.values()].map(cellKey));
  for (const group of groups) {
    const members = membersOf(group);
    const cells = [...members].map((id) => positions.get(id)).filter((cell): cell is Cell => cell !== undefined);
    if (cells.length === 0) continue;
    const [left, right] = [Math.min(...cells.map(([c]) => c)), Math.max(...cells.map(([c]) => c))];
    const [top, bottom] = [Math.min(...cells.map(([, r]) => r)), Math.max(...cells.map(([, r]) => r))];
    const within = ([c, r]: Cell): boolean => c >= left && c <= right && r >= top && r <= bottom;
    for (const [id, cell] of positions) {
      if (members.has(id) || pinned.has(id) || !within(cell)) continue;
      const seat = seats.find(([source, , target]) => (target === id && source !== id) || (source === id && target !== id));
      const [dc, dr] = seat === undefined ? DEFAULT_OFFSET : SIDE_OFFSET[seat[1]];
      const sign = seat === undefined || seat[2] === id ? 1 : -1;
      for (const [sc, sr] of [
        [dc * sign, dr * sign],
        [dr, dc],
        [-dr, -dc],
      ]) {
        let at: Cell = cell;
        do at = [at[0] + sc, at[1] + sr];
        while (within(at) && !taken.has(cellKey(at)));
        if (!within(at) && !taken.has(cellKey(at))) return { id, to: at, held: members };
      }
    }
  }
  return undefined;
}

function gridPositions(nodeIds: string[], seats: readonly Seat[], groups: readonly Subgraph[]): Map<string, [number, number]> {
  const pinned = new Map<string, Cell>();
  let positions = seated(nodeIds, seats, pinned);
  for (let round = 0; round < nodeIds.length; round++) {
    const out = intruder(positions, seats, groups, pinned);
    if (out === undefined) break;
    for (const id of out.held) pinned.set(id, must(positions.get(id)));
    pinned.set(out.id, out.to);
    positions = seated(nodeIds, seats, pinned);
  }

  const shifted = new Map<string, [number, number]>();
  if (positions.size === 0) return shifted;
  const minCol = Math.min(...[...positions.values()].map(([c]) => c));
  const minRow = Math.min(...[...positions.values()].map(([, r]) => r));
  for (const [id, [c, r]] of positions) shifted.set(id, [c - minCol, r - minRow]);
  return shifted;
}

function applyPositions(graph: Graph, positions: Map<string, [number, number]>): void {
  if (positions.size === 0) return;
  const maxCol = Math.max(...[...positions.values()].map(([c]) => c));
  const maxRow = Math.max(...[...positions.values()].map(([, r]) => r));
  graph.direction = maxCol >= maxRow ? Direction.LR : Direction.TB;
  graph.gridPositions = positions;
}
