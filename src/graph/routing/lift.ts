import { type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { cellId } from "./pathfinder.js";
import { segmentAt, type Marks, type RoutedEdge, riddenBy, inRounds } from "./routed.js";
import { isSelfReference, type Edge } from "../model.js";

const MAX_LIFT = 4;

// Runs sharing an end share a line on purpose, as a fan's legs do; a loop never does, and the run steps aside.
const kin = (one: Edge, two: Edge): boolean =>
  isSelfReference(one) === isSelfReference(two) && (one.source === two.source || one.target === two.target);
const movable = (re: RoutedEdge): boolean => !isSelfReference(re.edge);

function nearby(here: number, low: number, high: number): number[] {
  const out: number[] = [];
  for (let step = 1; step <= MAX_LIFT; step++) {
    for (const to of [here - step, here + step]) if (to > low && to < high) out.push(to);
  }
  return out;
}

// A run of another edge going the SAME way is not clear: the two would draw as one line. Crossing one IS the
// point of the move, so a crossing passes.
function clearFor(
  routed: RoutedEdge[],
  index: number,
  at: number,
  to: number,
  marks: Marks,
  solid: Set<string>
): boolean {
  const path = routed[index].drawPath;
  const [x1, y1] = path[at];
  const [x2, y2] = path[at + 1];
  const alongRow = y1 === y2;
  const here = alongRow ? y1 : x1;

  const taken = (x: number, y: number, corner: boolean): boolean => {
    const cell = cellId(x, y);
    if (solid.has(cell)) return true;
    if (corner) return riddenBy(marks, cell, index, true) || riddenBy(marks, cell, index, false);
    return riddenBy(marks, cell, index, alongRow);
  };

  const from = alongRow ? Math.min(x1, x2) : Math.min(y1, y2);
  const upto = alongRow ? Math.max(x1, x2) : Math.max(y1, y2);
  for (let a = from; a <= upto; a++) {
    const corner = a === from || a === upto;
    if (alongRow ? taken(a, to, corner) : taken(to, a, corner)) return false;
  }
  const step = to > here ? 1 : -1;
  for (let a = here + step; a !== to; a += step) {
    if (alongRow ? taken(x1, a, false) || taken(x2, a, false) : taken(a, y1, false) || taken(a, y2, false)) {
      return false;
    }
  }
  return true;
}

function liftRun(routed: RoutedEdge[], index: number, at: number, marks: Marks, solid: Set<string>): boolean {
  const path = routed[index].drawPath;
  if (at === 0 || at + 1 === path.length - 1) return false;
  const [x1, y1] = path[at];
  const [x2, y2] = path[at + 1];
  const alongRow = y1 === y2;
  const here = alongRow ? y1 : x1;
  const before = path[at - 1][alongRow ? 1 : 0];
  const after = path[at + 2][alongRow ? 1 : 0];
  const low = Math.min(before, after);
  const high = Math.max(before, after);
  if (here <= low || here >= high) return false;

  for (const to of nearby(here, low, high)) {
    if (!clearFor(routed, index, at, to, marks, solid)) continue;
    if (alongRow) {
      path[at] = [x1, to];
      path[at + 1] = [x2, to];
    } else {
      path[at] = [to, y1];
      path[at + 1] = [to, y2];
    }
    return true;
  }
  return false;
}

export function liftSharedCorners(routed: RoutedEdge[], layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>): void {
  inRounds(routed, layout, sgBounds, (marks, solid) => {
    let moved = false;
    for (const [cell, riders] of marks.passes) {
      const turning = marks.corners.get(cell);
      if (turning === undefined) continue;
      for (const [index] of riders) {
        if (turning.size === 1 && turning.has(index)) continue;
        const rider = routed[index].edge;
        if (!movable(routed[index]) || layout.placements.get(rider.source)?.mark === true) continue;
        const allKin = [...turning].every((other) => {
          if (other === index) return true;
          return kin(routed[other].edge, rider);
        });
        if (allKin) continue;
        const [x, y] = cell.split(",").map(Number);
        const at = segmentAt(routed[index].drawPath, x, y);
        if (at !== undefined && liftRun(routed, index, at, marks, solid)) {
          moved = true;
          break;
        }
      }
      if (moved) break;
    }
    return moved;
  });
}

// Two edges turning on one cell draw a crossing of lines that never meet: one of the runs into that corner steps aside,
// as long as each end keeps a stem of its own. A fan's legs, sharing an end, turn together on purpose.
const STEM = 2;
const stemmed = (path: ReadonlyArray<readonly [number, number]>): boolean =>
  [[path[0], path[1]], [path[path.length - 2], path[path.length - 1]]].every(([a, b]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) >= STEM);

export function partSharedTurns(routed: RoutedEdge[], layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>): void {
  inRounds(routed, layout, sgBounds, (marks, solid) => {
    for (const [cell, turning] of marks.corners) {
      const riders = [...turning];
      if (riders.every((index) => riders.every((other) => kin(routed[index].edge, routed[other].edge)))) continue;
      for (const index of riders.filter((one) => movable(routed[one]))) {
        const path = routed[index].drawPath;
        const k = path.findIndex(([x, y]) => cellId(x, y) === cell);
        for (const at of [k - 1, k]) {
          const saved = path.map(([x, y]): [number, number] => [x, y]);
          if (liftRun(routed, index, at, marks, solid) && stemmed(path)) return true;
          path.splice(0, path.length, ...saved);
        }
      }
    }
    return false;
  });
}

export function unbraidSharedRuns(routed: RoutedEdge[], layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>): void {
  inRounds(routed, layout, sgBounds, (marks, solid) => {
    let moved = false;
    for (const [cell, riders] of marks.passes) {
      if (riders.size < 2) continue;
      const held: Array<[number, boolean]> = [...riders];
      for (let a = 0; a < held.length && !moved; a++) {
        for (let b = a + 1; b < held.length && !moved; b++) {
          const [i, iAlong] = held[a];
          const [j, jAlong] = held[b];
          if (iAlong !== jAlong) continue;
          if (kin(routed[i].edge, routed[j].edge)) continue;
          const [x, y] = cell.split(",").map(Number);
          moved = (movable(routed[i]) && zigRun(routed, i, x, y, marks, solid)) || (movable(routed[j]) && zigRun(routed, j, x, y, marks, solid));
        }
      }
      if (moved) break;
    }
    return moved;
  });
}

function zigRun(
  routed: RoutedEdge[],
  index: number,
  x: number,
  y: number,
  marks: Marks,
  solid: Set<string>
): boolean {
  const path = routed[index].drawPath;
  const k = segmentAt(path, x, y);
  if (k === undefined) return false;
  const [, y1] = path[k];
  const [, y2] = path[k + 1];
  const alongRow = y1 === y2;

  const taken = (cx: number, cy: number, corner: boolean): boolean => {
    const at = cellId(cx, cy);
    if (solid.has(at)) return true;
    const foreign = (held: Set<number> | undefined): boolean =>
      held !== undefined && [...held].some((one) => one !== index);
    if (foreign(marks.corners.get(at)) || foreign(marks.ends.get(at))) return true;
    const passing = marks.passes.get(at);
    if (passing === undefined) return false;
    for (const [other, along] of passing) {
      if (other === index) continue;
      if (corner || along === alongRow) return true;
    }
    return false;
  };

  for (const m of [k - 1, k + 1]) {
    if (m < 0 || m + 1 >= path.length) continue;
    if (m === 0 || m + 1 === path.length - 1) continue;
    const junction = m < k ? k : k + 1;
    const farEnd = m < k ? k + 1 : k;
    const [jx, jy] = path[junction];
    const [fx, fy] = path[farEnd];
    const other = path[m < k ? m : m + 1];
    const away = alongRow ? other[1] : other[0];
    const here = alongRow ? jy : jx;
    const along = alongRow ? jx : jy;
    const limit = alongRow ? fx : fy;
    const stepAcross = Math.sign(away - here);
    const stepAlong = Math.sign(limit - along);
    if (stepAcross === 0 || stepAlong === 0) continue;

    for (let my = away - stepAcross; my !== here; my -= stepAcross) {
      for (let nx = along + stepAlong; nx !== limit; nx += stepAlong) {
        const corner = (cx: number, cy: number): boolean => taken(cx, cy, true);
        const cells = (fromA: number, toA: number, atB: number, row: boolean): boolean => {
          const step = Math.sign(toA - fromA);
          for (let c = fromA + step; c !== toA; c += step) {
            if (row ? taken(c, atB, false) : taken(atB, c, false)) return true;
          }
          return false;
        };
        const blocked = alongRow
          ? corner(along, my) || corner(nx, my) || corner(nx, here) ||
            cells(along, nx, my, true) || cells(my, here, nx, false)
          : corner(my, along) || corner(my, nx) || corner(here, nx) ||
            cells(along, nx, my, false) || cells(my, here, nx, true);
        if (blocked) continue;

        const bridge: Array<[number, number]> = alongRow ? [[along, my], [nx, my]] : [[my, along], [my, nx]];
        path[junction] = alongRow ? [nx, here] : [here, nx];
        if (m < k) path.splice(junction, 0, ...bridge);
        else path.splice(junction + 1, 0, ...(bridge.reverse()));
        return true;
      }
    }
  }
  return false;
}
