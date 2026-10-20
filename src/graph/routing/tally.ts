import { cellId } from "./pathfinder.js";
import { type Kin } from "./lanes.js";
import { type RoutedEdge } from "./routed.js";
import { ensured, must } from "../../must.js";

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

// What one run leaves on a cell: a corner or an end, the way it passes there, its heads standing there, and the way
// of each of its steps the cell lies beside.
interface Mark {
  corner: boolean;
  end: boolean;
  along?: boolean;
  heads: number;
  beside: boolean[];
}

function marksOf(path: ReadonlyArray<readonly [number, number]>): Map<string, Mark> {
  const marks = new Map<string, Mark>();
  const at = (x: number, y: number): Mark => ensured(marks, cellId(x, y), () => ({ corner: false, end: false, heads: 0, beside: [] }));
  if (path.length < 2) return marks;
  path.forEach(([x, y], k) => {
    if (k === 0 || k === path.length - 1) at(x, y).end = true;
    else at(x, y).corner = true;
  });
  for (let k = 0; k + 1 < path.length; k++) {
    const [[x1, y1], [x2, y2]] = [path[k], path[k + 1]];
    const alongRow = y1 === y2;
    const [from, to] = alongRow ? [x1, x2] : [y1, y2];
    const step = Math.sign(to - from);
    for (let a = from + step; step !== 0 && a !== to; a += step) {
      if (alongRow) at(a, y1).along = true;
      else at(x1, a).along = false;
      (alongRow ? at(a, y1 + 1) : at(x1 + 1, a)).beside.push(alongRow);
    }
  }
  for (const [end, next] of [[path[0], path[1]], [path[path.length - 1], path[path.length - 2]]]) {
    at(end[0] + Math.sign(next[0] - end[0]), end[1] + Math.sign(next[1] - end[1])).heads++;
  }
  return marks;
}

// Every count stands on one cell, so a run moved changes the tally only on the cells it leaves or takes.
export interface Tallied {
  move(index: number, path: Array<[number, number]>): Tally;
  readonly total: Tally;
}

export function tallied(routed: readonly RoutedEdge[], solid: ReadonlySet<string>, kin: Kin = shareABox): Tallied {
  const cells = new Map<string, Map<number, Mark>>();
  const own = routed.map((re) => marksOf(re.drawPath));
  const total: Tally = { crossings: 0, overlaps: 0, glued: 0, solid: 0 };
  const gluedTo = (here: Map<number, Mark>, one: number, alongRow: boolean): boolean => {
    for (const [other, mark] of here) if (other !== one && mark.along === alongRow && !kin(routed[other].edge, routed[one].edge)) return true;
    return false;
  };
  const weigh = (id: string, sign: 1 | -1): void => {
    const here = cells.get(id);
    if (here === undefined) return;
    let corners = 0;
    let ends = 0;
    let rows = 0;
    let columns = 0;
    let corner = -1;
    let end = -1;
    for (const [one, mark] of here) {
      if (mark.corner) {
        corners++;
        corner = one;
      }
      if (mark.end) {
        ends++;
        end = one;
      }
      if (mark.along === true) rows++;
      if (mark.along === false) columns++;
    }
    const passing = rows + columns;
    let overlaps = Math.max(corners - 1, 0) + Math.max(ends - 1, 0);
    let glued = 0;
    if (passing > 0) overlaps += (rows * (rows - 1) + columns * (columns - 1)) / 2;
    for (const [one, mark] of here) {
      if (mark.along !== undefined) overlaps += Number(corners > 1 || (corners === 1 && corner !== one)) + Number(ends > 1 || (ends === 1 && end !== one));
      if (passing - Number(mark.along !== undefined) > 0) overlaps += mark.heads;
      for (const alongRow of mark.beside) glued += Number(gluedTo(here, one, alongRow));
    }
    total.crossings += sign * rows * columns;
    total.overlaps += sign * overlaps;
    total.glued += sign * glued;
    if (passing > 0 && solid.has(id)) total.solid += sign;
  };
  const place = (index: number, sign: 1 | -1): void => {
    for (const [id, mark] of own[index]) {
      if (sign === 1) ensured(cells, id, () => new Map()).set(index, mark);
      else {
        const here = must(cells.get(id), "the cell a run marked");
        here.delete(index);
        if (here.size === 0) cells.delete(id);
      }
    }
  };
  routed.forEach((_re, index) => place(index, 1));
  for (const id of cells.keys()) weigh(id, 1);
  return {
    move(index, path) {
      const next = marksOf(path);
      const touched = new Set([...own[index].keys(), ...next.keys()]);
      for (const id of touched) weigh(id, -1);
      place(index, -1);
      own[index] = next;
      routed[index].drawPath = path;
      place(index, 1);
      for (const id of touched) weigh(id, 1);
      return { ...total };
    },
    get total() {
      return { ...total };
    },
  };
}

export const tally = (routed: readonly RoutedEdge[], solid: ReadonlySet<string>, kin?: Kin): Tally => tallied(routed, solid, kin).total;

export const notWorse = (after: Tally, before: Tally): boolean =>
  after.crossings <= before.crossings && after.overlaps <= before.overlaps && after.glued <= before.glued && after.solid <= before.solid;
