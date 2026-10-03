import { type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { cellId } from "./pathfinder.js";
import { boxedAt, cellsOf, heldCells, type Marks, type RoutedEdge, inRounds, solidCells } from "./routed.js";
import { notWorse, tally } from "./tally.js";
import { spanOf } from "./clusters.js";
import { type Kin } from "./lanes.js";

export function retreatCrampedElbows(routed: RoutedEdge[], layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>): void {
  inRounds(routed, layout, sgBounds, (marks, solid) => {
    let moved = false;
    routed.forEach((re, index) => {
      if (moved || re.drawPath.length < 4) return;
      const last = re.drawPath.length - 1;
      if (re.edge.hasArrowEnd && retreatElbow(re.drawPath, last, index, marks, solid)) moved = true;
      if (!moved && re.edge.hasArrowStart && retreatElbow(re.drawPath, 0, index, marks, solid)) moved = true;
    });
    return moved;
  });
}

export function retreatElbow(
  path: Array<[number, number]>,
  end: number,
  index: number,
  marks: Marks,
  solid: Set<string>,
  clearance = 1
): boolean {
  const inward = end === 0 ? 1 : -1;
  const border = path[end];
  const corner = path[end + inward];
  const feed = path[end + 2 * inward];
  const anchor = path[end + 3 * inward];
  const dx = Math.sign(border[0] - corner[0]);
  const dy = Math.sign(border[1] - corner[1]);
  if (Math.abs(border[0] - corner[0]) + Math.abs(border[1] - corner[1]) !== clearance) return false;
  if (Math.sign(corner[0] - feed[0]) === dx && Math.sign(corner[1] - feed[1]) === dy) return false;
  if (Math.abs(anchor[0] - feed[0]) + Math.abs(anchor[1] - feed[1]) < 2) return false;

  const corner2: [number, number] = [corner[0] - dx, corner[1] - dy];
  const feed2: [number, number] = [feed[0] - dx, feed[1] - dy];
  const stepX = Math.sign(corner2[0] - feed2[0]);
  const stepY = Math.sign(corner2[1] - feed2[1]);
  const alongRow = stepY === 0;
  for (let x = feed2[0], y = feed2[1]; ; x += stepX, y += stepY) {
    const at = cellId(x, y);
    const passing = marks.passes.get(at);
    const foreign = (held: Set<number> | undefined): boolean =>
      held !== undefined && [...held].some((one) => one !== index);
    const isCorner = (x === feed2[0] && y === feed2[1]) || (x === corner2[0] && y === corner2[1]);
    const ridden =
      passing !== undefined && [...passing].some(([one, along]) => one !== index && (isCorner || along === alongRow));
    const pierces = !isCorner && solid.has(at) && solid.has(cellId(x + dx, y + dy));
    if ((solid.has(at) && !pierces) || foreign(marks.corners.get(at)) || foreign(marks.ends.get(at)) || ridden) return false;
    if (x === corner2[0] && y === corner2[1]) break;
  }

  path[end + inward] = corner2;
  path[end + 2 * inward] = feed2;
  return true;
}

export function tidyDrawPath(path: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const point of path) {
    const last = out[out.length - 1];
    if (last !== undefined && last[0] === point[0] && last[1] === point[1]) continue;
    out.push(point);
  }
  for (let i = 1; i + 1 < out.length; ) {
    const [p, q, r] = [out[i - 1], out[i], out[i + 1]];
    if ((p[0] === q[0] && q[0] === r[0]) || (p[1] === q[1] && q[1] === r[1])) out.splice(i, 1);
    else i++;
  }
  return out;
}

export function straightenDetours(routed: RoutedEdge[], layout: GridLayout): void {
  const held = heldCells(routed);
  const boxed = boxedAt(layout);
  for (const re of routed) {
    if (re.edge.sourceIsSubgraph || re.edge.targetIsSubgraph || re.label !== "") continue;
    const src = layout.placements.get(re.edge.source);
    const tgt = layout.placements.get(re.edge.target);
    if (src === undefined || tgt === undefined || src.bar || tgt.bar) continue;
    let again = true;
    while (again) {
      again = false;
      const path = re.drawPath;
      for (let i = 0; i + 3 < path.length; i++) {
        const [a, b, c, d] = [path[i], path[i + 1], path[i + 2], path[i + 3]];
        let along: 0 | 1;
        if (a[0] === b[0] && b[1] === c[1] && c[0] === d[0] && a[0] !== c[0]) along = 1;
        else if (a[1] === b[1] && b[0] === c[0] && c[1] === d[1] && a[1] !== c[1]) along = 0;
        else continue;
        const across = along === 1 ? 0 : 1;
        const out = Math.sign(b[along] - a[along]);
        const back = Math.sign(d[along] - c[along]);
        if (out === 0 || back !== -out || (d[along] - a[along]) * out > 0) continue;
        const corner: [number, number] = [0, 0];
        corner[along] = a[along];
        corner[across] = c[across];
        const chord: RoutedEdge = { ...re, drawPath: [a, corner] };
        let open = true;
        for (const [x, y] of cellsOf(chord)) {
          if (x === a[0] && y === a[1]) continue;
          const other = held.get(cellId(x, y));
          if ((other !== undefined && other !== re) || boxed(x, y)) {
            open = false;
            break;
          }
        }
        if (!open) continue;
        for (const [x, y] of cellsOf(re)) if (held.get(cellId(x, y)) === re) held.delete(cellId(x, y));
        const rebuilt = [...path.slice(0, i + 1), corner, ...path.slice(i + 3)];
        re.drawPath = tidyDrawPath(rebuilt);
        for (const [x, y] of cellsOf(re)) held.set(cellId(x, y), re);
        again = true;
        break;
      }
    }
  }
}

const heading = (from: readonly [number, number], to: readonly [number, number]): string => `${Math.sign(to[0] - from[0])},${Math.sign(to[1] - from[1])}`;

// The one corner that stands for a step the run takes twice the same way, or for a step out and back.
function flattened(path: Array<[number, number]>, i: number): Array<[number, number]> | undefined {
  const [q0, q1, q2, q3, q4] = [path[i], path[i + 1], path[i + 2], path[i + 3], path[i + 4]];
  const along = q0[1] === q1[1] ? 0 : 1;
  const corner: [number, number] = [0, 0];
  if (q4 !== undefined && heading(q0, q1) === heading(q2, q3) && heading(q1, q2) === heading(q3, q4)) {
    corner[along] = q3[along];
    corner[1 - along] = q0[1 - along];
    return tidyDrawPath([...path.slice(0, i + 1), corner, ...path.slice(i + 4)]);
  }
  // A step out of a box or into one is the side the run meets it on, never a bump.
  const out = heading(q0, q1);
  if (i === 0 || i + 3 === path.length - 1 || heading(q3, q2) !== out) return undefined;
  corner[along] = q0[along];
  corner[1 - along] = q2[1 - along];
  return tidyDrawPath([...path.slice(0, i + 1), corner, ...path.slice(i + 3)]);
}

// A last step onto a frame's rule is the end sliding along it: the run meets the rule on the line it already runs on.
function slidOnto(path: Array<[number, number]>, atEnd: boolean): Array<[number, number]> | undefined {
  const ordered = atEnd ? path : [...path].reverse();
  const n = ordered.length;
  if (n < 4) return undefined;
  const [q0, q1, q2, end] = [ordered[n - 4], ordered[n - 3], ordered[n - 2], ordered[n - 1]];
  if (heading(q0, q1) !== heading(q2, end)) return undefined;
  const along = q2[1] === end[1] ? 0 : 1;
  const moved: [number, number] = [0, 0];
  moved[along] = end[along];
  moved[1 - along] = q0[1 - along];
  const out = tidyDrawPath([...ordered.slice(0, n - 3), moved]);
  return atEnd ? out : out.reverse();
}

// A run that steps twice the same way, or out and back, takes the one corner the steps stand for, and a run stepping
// onto a frame's rule meets it on its own line, wherever that crosses, rides and hugs no more than the steps did.
export function flattenSteps(routed: RoutedEdge[], layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>, kin?: Kin): void {
  const solid = solidCells(layout, sgBounds);
  const fits = (re: RoutedEdge, path: Array<[number, number]>, atEnd: boolean): boolean => {
    const end = atEnd ? path[path.length - 1] : path[0];
    const next = atEnd ? path[path.length - 2] : path[1];
    const alongRow = end[1] === next[1];
    const span = spanOf(layout, sgBounds, () => undefined, atEnd ? re.edge.target : re.edge.source, alongRow);
    const seat = alongRow ? end[1] : end[0];
    return span !== undefined && seat >= span[0] && seat <= span[1];
  };
  for (const re of routed) {
    if (re.label !== "") continue;
    for (let again = true; again; ) {
      again = false;
      const path = re.drawPath;
      const tidy = tidyDrawPath(path);
      // A point standing on a straight run reads as a corner on whatever crosses there: the steps are weighed tidy.
      re.drawPath = tidy;
      const before = tally(routed, solid, kin);
      re.drawPath = path;
      const candidates: Array<Array<[number, number]> | undefined> = [];
      for (let i = 0; i + 3 < tidy.length; i++) candidates.push(flattened(tidy, i));
      for (const atEnd of [true, false]) {
        if (!(atEnd ? re.edge.targetIsSubgraph : re.edge.sourceIsSubgraph)) continue;
        const slid = slidOnto(tidy, atEnd);
        candidates.push(slid !== undefined && fits(re, slid, atEnd) ? slid : undefined);
      }
      for (const shorter of candidates) {
        if (again || shorter === undefined || shorter.length >= tidy.length) continue;
        re.drawPath = shorter;
        if (notWorse(tally(routed, solid, kin), before)) again = true;
        else re.drawPath = path;
      }
    }
  }
}

export function centreElbows(routed: RoutedEdge[], layout: GridLayout, flowVertical: boolean): void {
  const held = heldCells(routed);
  const boxed = boxedAt(layout);

  for (const re of routed) {
    if (re.drawPath.length !== 4 || re.edge.sourceIsSubgraph || re.edge.targetIsSubgraph || re.label !== "") continue;
    const src = layout.placements.get(re.edge.source);
    const tgt = layout.placements.get(re.edge.target);
    if (src === undefined || tgt === undefined || src.bar || tgt.bar) continue;
    const [a, b, c, d] = re.drawPath;
    const vertical = a[0] === b[0] && b[1] === c[1] && c[0] === d[0];
    const horizontal = a[1] === b[1] && b[0] === c[0] && c[1] === d[1];
    if (vertical === horizontal || !vertical || !flowVertical) continue;
    const along = vertical ? 1 : 0;
    const across = vertical ? 0 : 1;
    const first = a[along];
    const last = d[along];
    if (Math.abs(last - first) < 3) continue;
    const step = Math.sign(last - first);
    const middle = first + step * Math.floor(Math.abs(last - first) / 2);
    if (middle === b[along]) continue;
    const moved: Array<[number, number]> = [a, [0, 0], [0, 0], d];
    moved[1][along] = middle;
    moved[1][across] = b[across];
    moved[2][along] = middle;
    moved[2][across] = c[across];
    const trial: RoutedEdge = { ...re, drawPath: moved };
    let free = true;
    for (const [x, y] of cellsOf(trial)) {
      const other = held.get(cellId(x, y));
      if ((other !== undefined && other !== re) || (boxed(x, y) && !(x === a[0] && y === a[1]) && !(x === d[0] && y === d[1]))) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    for (const [x, y] of cellsOf(re)) if (held.get(cellId(x, y)) === re) held.delete(cellId(x, y));
    re.drawPath = moved;
    for (const [x, y] of cellsOf(re)) held.set(cellId(x, y), re);
  }
}
