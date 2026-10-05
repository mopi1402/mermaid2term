import { LOLLIPOP, type ClassDiagram, type Detour, type Relationship, type Layout } from "./model.js";
import { must, pushInto } from "../../must.js";
import { labelLines, widestLabelLine } from "../../text/labels.js";
import { ARRIVAL_SPREAD, EXIT_SPREAD, KEY_SEP, SIDE_BOTTOM, SIDE_LEFT, SIDE_RIGHT, SIDE_SIDE, loopSideOf } from "./metrics.js";
import { fanCells, stackedRows } from "../@common/fans.js";
import { loopSpan, nestRows } from "./nests.js";
import type { RowCol } from "../../canvas/elbow.js";
import type { Toward } from "../../canvas/corners.js";

type RelGeometry = {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  horizontal: boolean;
  forward: boolean;
  bendRow: number;
};

export function relationshipGeometry(
  rel: Relationship,
  layout: Layout,
  colOffset: number,
  isLR: boolean,
  endOffset = 0,
  bendRank: number | undefined = undefined
): RelGeometry | undefined {
  const { positions, sizes, layerOf } = layout;
  const source = positions.get(rel.source);
  const target = positions.get(rel.target);
  if (source === undefined || target === undefined) return undefined;

  const [sx, sy] = source;
  const [sw, sh] = must(sizes.get(rel.source));
  const [tx, ty] = target;
  const [tw, th] = must(sizes.get(rel.target));

  const sourceMidCol = sx + Math.floor(sw / 2);
  const sourceMidRow = sy + Math.floor(sh / 2);
  const targetMidCol = tx + Math.floor(tw / 2);
  const targetMidRow = ty + Math.floor(th / 2);

  const sameLayer = (layerOf.get(rel.source) ?? -1) === (layerOf.get(rel.target) ?? -2);
  const horizontal = isLR ? !sameLayer : sameLayer;

  if (!horizontal) {
    const downward = targetMidRow - sourceMidRow > 0;
    const startRow = downward ? sy + sh : sy - 1;
    const endRow = downward ? ty - 1 : ty + th;
    let seen = downward ? ty : ty + th - 1;
    for (const frame of layout.frames) {
      const holds = (x: number, y: number): boolean =>
        x >= frame.x && x < frame.x + frame.width && y >= frame.y && y < frame.y + frame.height;
      if (!holds(targetMidCol, targetMidRow) || holds(sourceMidCol, sourceMidRow)) continue;
      seen = downward ? Math.min(seen, frame.y) : Math.max(seen, frame.y + frame.height - 1);
    }
    // A nest riding the rows past a lid keeps the bend out of them, at either end.
    // So do the detours a layer sends round past the side facing the other end.
    const gapEnd = downward
      ? seen - 1 - nestRows(layout, rel.target, false) - rideRoomToward(layout, rel.target, rel.source)
      : seen + 1 + nestRows(layout, rel.target, true) + rideRoomToward(layout, rel.target, rel.source);
    const from = downward
      ? startRow + nestRows(layout, rel.source, true) + rideRoomToward(layout, rel.source, rel.target)
      : startRow - nestRows(layout, rel.source, false) - rideRoomToward(layout, rel.source, rel.target);
    // The chip past the bend takes a row per row of its label, so a bend in the middle turns that much sooner.
    const sooner = labelLines(rel.label) - 1;
    const middle = Math.floor((from + gapEnd) / 2);
    return {
      startCol: sourceMidCol + colOffset,
      startRow,
      endCol: Math.max(tx + 1, Math.min(tx + tw - 2, targetMidCol + endOffset)),
      endRow,
      horizontal,
      forward: downward,
      // Each edge of a fan that needs a row of its own turns one row further into the gap than the last; an edge
      // that shares its rows with nothing keeps the middle of the gap.
      bendRow: bendRank === undefined
        ? downward
          ? Math.max(Math.min(from + 1, middle), middle - sooner)
          : Math.min(Math.max(from - 1, middle), middle + sooner)
        : downward
          ? Math.min(gapEnd, from + 1 + bendRank)
          : Math.max(gapEnd, from - 1 - bendRank),
    };
  }
  const rightward = targetMidCol - sourceMidCol > 0;
  const step = rightward ? 1 : -1;
  // A lollipop has no wall: its ring stands in the middle of its name, and the run goes on until it touches it.
  const sourceRing = rel.sourceMarker === LOLLIPOP;
  const targetRing = rel.targetMarker === LOLLIPOP;
  const seated = sourceRing ? sourceMidRow : sideSeat(layout, rel.source, isLR ? colOffset : 0, step);
  const met = targetRing ? targetMidRow : sideSeat(layout, rel.target, isLR ? endOffset : 0, -step);
  // A straight run moved off a rule or under a loop keeps straight when the other wall has that row free.
  const kept = Math.max(seated, met);
  const straight =
    !sourceRing &&
    !targetRing &&
    seated !== met &&
    wantedSeat(layout, rel.source, isLR ? colOffset : 0) === wantedSeat(layout, rel.target, isLR ? endOffset : 0) &&
    seatFree(layout, rel.source, step, kept) &&
    seatFree(layout, rel.target, -step, kept);
  const spread = straight ? kept : seated;
  return {
    startCol: sourceRing ? sourceMidCol + step : rightward ? sx + sw : sx - 1,
    startRow: spread,
    endCol: targetRing ? targetMidCol - step : rightward ? tx - 1 : tx + tw,
    endRow: straight ? kept : met,
    horizontal,
    forward: rightward,
    bendRow: Math.floor((spread + targetMidRow) / 2),
  };
}

const extentOf = (layout: Layout, name: string): readonly [number, number] => [must(layout.positions.get(name))[1], must(layout.sizes.get(name))[1]];

const looped = (layout: Layout, name: string, faces: number): boolean => layout.loops.has(name) && loopSideOf(layout, name) === faces;

function wantedSeat(layout: Layout, name: string, offset: number): number {
  const [y, h] = extentOf(layout, name);
  return Math.max(y + 1, Math.min(y + h - 2, y + Math.floor(h / 2) + offset));
}

// A side row a relation may meet: inside the walls, off every compartment rule, and under a self relation's loop on
// the wall it loops out of.
function seatFree(layout: Layout, name: string, faces: number, row: number): boolean {
  const [y, h] = extentOf(layout, name);
  if (row < y + 1 || row > y + h - 2) return false;
  if (looped(layout, name, faces) && row >= loopSpan(layout, name)[0] && row <= loopSpan(layout, name)[1]) return false;
  return !(layout.rules?.get(name) ?? []).some((rule) => y + rule === row);
}

// The row a relation meets a class's side on, `offset` off its middle and within its walls. A compartment rule runs into
// the wall, where a tee would make a crossing of it: the relation steps off the rule, away from the middle. On the wall
// a self relation loops out of, the seats move under the loop, a row of air between them where the box has it.
function sideSeat(layout: Layout, name: string, offset: number, faces: number): number {
  const [y, h] = extentOf(layout, name);
  const [first, last] = loopSpan(layout, name);
  const mid = y + Math.floor(h / 2);
  const under = first === y ? last + 2 - mid : first - 2 - mid;
  const shift = looped(layout, name, faces) && mid >= first && mid <= last ? under : 0;
  const wanted = Math.max(y + 1, Math.min(y + h - 2, wantedSeat(layout, name, offset) + shift));
  if (seatFree(layout, name, faces, wanted)) return wanted;
  const away = shift < 0 || (offset < 0 && shift === 0) ? -1 : 1;
  for (const step of [away, -away]) {
    for (let row = wanted + step; row >= y + 1 && row <= y + h - 2; row += step) if (seatFree(layout, name, faces, row)) return row;
  }
  return wanted;
}

// Two relations between the SAME pair used to leave apart and arrive on one cell, so their two shafts bent into one
// corner and their labels ran together. An arrival is spread the way an exit is, off the wall it lands on.
export interface FanRun {
  index: number;
  exit: number;
  to: number;
}

// One turn row per run that needs one, for every box a fan leaves, on each side apart.
export function fanBends(runs: Array<[string, FanRun]>): Map<number, number> {
  const groups = new Map<string, FanRun[]>();
  for (const [source, run] of runs) {
    const key = `${source}${KEY_SEP}${run.to < run.exit ? SIDE_LEFT : SIDE_RIGHT}`;
    pushInto(groups, key, run);
  }
  const bends = new Map<number, number>();
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const ordered = [...group].sort((a, b) => Math.abs(b.to - b.exit) - Math.abs(a.to - a.exit) || a.index - b.index);
    const spans = ordered.map((run) => [Math.min(run.exit, run.to), Math.max(run.exit, run.to)] as const);
    const rows = stackedRows(spans);
    // A fork whose runs share no column needs no ladder at all: every one of them keeps the middle of the gap,
    // which is where a single edge turns and where these drawings have always turned.
    if (Math.max(...rows) === 0) continue;
    rows.forEach((row, k) => bends.set(ordered[k].index, row));
  }
  return bends;
}

export function midAlong(layout: Layout, name: string, isLR: boolean): number {
  const at = layout.positions.get(name);
  const size = layout.sizes.get(name);
  if (at === undefined || size === undefined) return 0;
  return isLR ? at[1] + Math.floor(size[1] / 2) : at[0] + Math.floor(size[0] / 2);
}

function spreadOffsets(diagram: ClassDiagram, layout: Layout, isLR: boolean, end: boolean): Map<number, number> {
  const { layerOf } = layout;
  const groups = new Map<string, number[]>();
  diagram.relationships.forEach((rel, index) => {
    if (rel.source === rel.target || layout.detours?.has(rel) === true) return;
    const sameLayer = (layerOf.get(rel.source) ?? -1) === (layerOf.get(rel.target) ?? -2);
    const key = `${end ? rel.target : rel.source}${KEY_SEP}${sameLayer ? SIDE_SIDE : SIDE_BOTTOM}`;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [index]);
    else group.push(index);
  });

  const offsets = new Map<number, number>();
  for (const indices of groups.values()) {
    if (indices.length <= 1) {
      for (const index of indices) offsets.set(index, 0);
      continue;
    }
    const spread = end ? ARRIVAL_SPREAD : EXIT_SPREAD;
    // In the order the far ends stand, never the order they were written: a fan whose leftmost edge leaves by the
    // leftmost cell never has to cross one of its own siblings.
    const other = (index: number): string => {
      const rel = diagram.relationships[index];
      return end ? rel.source : rel.target;
    };
    const cells = fanCells(indices.length, spread);
    [...indices]
      .sort((a, b) => midAlong(layout, other(a), isLR) - midAlong(layout, other(b), isLR) || a - b)
      .forEach((index, j) => offsets.set(index, cells[j]));
  }
  return offsets;
}

// The ends of every relation, exits and arrivals, spread along each box face. A face only ever met by exits, or only
// by arrivals, keeps the fan its own kind lays; a face where both meet, `C --> D` beside `D --> C`, spreads them
// together as the ER does, or the two would seat on one cell and draw as a single run.
export function computeEndOffsets(diagram: ClassDiagram, layout: Layout, isLR: boolean): readonly [Map<number, number>, Map<number, number>] {
  const exits = spreadOffsets(diagram, layout, isLR, false);
  const arrivals = spreadOffsets(diagram, layout, isLR, true);
  const { layerOf } = layout;
  const faceOf = (box: string, partner: string): string => {
    const own = layerOf.get(box) ?? -1;
    const far = layerOf.get(partner) ?? -2;
    const side = own === far ? Math.sign(midAlong(layout, partner, isLR) - midAlong(layout, box, isLR)) : Math.sign(far - own);
    return `${box}${KEY_SEP}${own === far ? SIDE_SIDE : SIDE_BOTTOM}${KEY_SEP}${side}`;
  };
  const faces = new Map<string, Array<readonly [index: number, end: boolean, partner: string]>>();
  diagram.relationships.forEach((rel, index) => {
    if (rel.source === rel.target || layout.detours?.has(rel) === true) return;
    for (const [box, partner, end] of [
      [rel.source, rel.target, false],
      [rel.target, rel.source, true],
    ] as const) {
      const key = faceOf(box, partner);
      faces.set(key, [...(faces.get(key) ?? []), [index, end, partner]]);
    }
  });
  for (const ends of faces.values()) {
    if (!ends.some(([, end]) => end) || !ends.some(([, end]) => !end)) continue;
    const cells = fanCells(ends.length, EXIT_SPREAD);
    [...ends]
      .sort((a, b) => midAlong(layout, a[2], isLR) - midAlong(layout, b[2], isLR) || a[0] - b[0] || Number(a[1]) - Number(b[1]))
      .forEach(([index, end], j) => (end ? arrivals : exits).set(index, cells[j]));
  }
  return [exits, arrivals];
}

// The turn row each edge of a fan owns. Two runs leaving one box on the same side and sharing columns cannot turn
// on one row, which is how a fan used to draw its corners over each other; the farthest turns first, nearest the
// source, so its drop rides a column no shorter run reaches and the fan nests.
export function computeBendRanks(diagram: ClassDiagram, layout: Layout, exits: Map<number, number>): Map<number, number> {
  const midOf = (name: string): number | undefined => {
    const at = layout.positions.get(name);
    const size = layout.sizes.get(name);
    return at === undefined || size === undefined ? undefined : at[0] + Math.floor(size[0] / 2);
  };
  const runs: Array<[string, FanRun]> = [];
  diagram.relationships.forEach((rel, index) => {
    if (rel.source === rel.target) return;
    if ((layout.layerOf.get(rel.source) ?? -1) === (layout.layerOf.get(rel.target) ?? -2)) return;
    const from = midOf(rel.source);
    const to = midOf(rel.target);
    if (from === undefined || to === undefined) return;
    runs.push([rel.source, { index, exit: from + Math.trunc(exits.get(index) ?? 0), to }]);
  });
  return fanBends(runs);
}

// The relations within one layer whose straight run would cross another box of it, each with the rank of the ride
// it takes past the layer: rides sharing columns stack, the shortest nearest the boxes.
export function detourRanks<R extends { source: string; target: string }>(
  relations: readonly R[],
  layerOf: ReadonlyMap<string, number>,
  midOf: (name: string) => number | undefined
): Map<R, number> {
  const byLayer = new Map<number, Array<readonly [R, number, number]>>();
  for (const rel of relations) {
    const layer = layerOf.get(rel.source);
    const one = midOf(rel.source);
    const two = midOf(rel.target);
    if (rel.source === rel.target || layer === undefined || layer !== layerOf.get(rel.target) || one === undefined || two === undefined) continue;
    const [lo, hi] = [Math.min(one, two), Math.max(one, two)];
    const crossed = [...layerOf].some(([name, at]) => {
      const mid = at === layer && name !== rel.source && name !== rel.target ? midOf(name) : undefined;
      return mid !== undefined && mid > lo && mid < hi;
    });
    if (crossed) byLayer.set(layer, [...(byLayer.get(layer) ?? []), [rel, lo, hi]]);
  }
  const ranks = new Map<R, number>();
  for (const runs of byLayer.values()) {
    const ordered = [...runs].sort((a, b) => a[2] - a[1] - (b[2] - b[1]));
    stackedRows(ordered.map(([, lo, hi]) => [lo, hi] as const)).forEach((row, k) => ranks.set(ordered[k][0], row));
  }
  return ranks;
}

// The cells past each layer's far side its detours ride, one per rank, and down the page the labels beside them.
export function rideRoomOf<R extends { source: string; label: string }>(ranks: ReadonlyMap<R, number>, layerOf: ReadonlyMap<string, number>, isLR: boolean): Map<number, number> {
  const rides = new Map<number, number>();
  const labels = new Map<number, number>();
  for (const [rel, rank] of ranks) {
    const layer = must(layerOf.get(rel.source));
    rides.set(layer, Math.max(rides.get(layer) ?? 0, rank + 1));
    if (isLR && rel.label !== "") labels.set(layer, Math.max(labels.get(layer) ?? 0, widestLabelLine(rel.label) + 2));
  }
  return new Map([...rides].map(([layer, room]) => [layer, room + (labels.get(layer) ?? 0)]));
}

// What a relation leaving `box` toward `partner` crosses first: the rides of the box's layer past the side facing it.
export function rideRoomToward(layout: Layout, box: string, partner: string): number {
  const own = layout.layerOf.get(box);
  const far = layout.layerOf.get(partner);
  return own === undefined || far === undefined || far <= own ? 0 : (layout.rideRoom?.get(own) ?? 0);
}

// The cells of each box's far wall the relations to a further layer already hold: columns, or rows down the page.
export function heldOnRideFace(diagram: ClassDiagram, layout: Layout, isLR: boolean, exits: Map<number, number>, arrivals: Map<number, number>): Map<string, Set<number>> {
  const held = new Map<string, Set<number>>();
  const hold = (box: string, cell: number): void => {
    held.set(box, (held.get(box) ?? new Set()).add(cell));
  };
  diagram.relationships.forEach((rel, index) => {
    if (rel.source === rel.target || layout.detours?.has(rel) === true) return;
    const g = relationshipGeometry(rel, layout, Math.trunc(exits.get(index) ?? 0), isLR, Math.trunc(arrivals.get(index) ?? 0));
    if (g === undefined) return;
    if (rideRoomToward(layout, rel.source, rel.target) > 0) hold(rel.source, isLR ? g.startRow : g.startCol);
    if (rideRoomToward(layout, rel.target, rel.source) > 0) hold(rel.target, isLR ? g.endRow : g.endCol);
  });
  return held;
}

// Every detour of the drawing, its ride a row (or column) past its layer's far side and a row of air off the walls.
// Several ends on one wall spread apart, the ones going left on the left, a ride further out leaving nearer the
// middle so the detours nest instead of crossing, and beside the cells the relations to a further layer hold there.
export function detoursOf(
  ranks: ReadonlyMap<Relationship, number>,
  layout: Layout,
  isLR: boolean,
  side: number,
  held: ReadonlyMap<string, ReadonlySet<number>>
): Map<Relationship, Detour> {
  const across = isLR ? 0 : 1;
  const farEdge = (layer: number): number => {
    const edges = [...layout.layerOf].flatMap(([name, at]) => {
      const pos = layout.positions.get(name);
      const size = layout.sizes.get(name);
      return at !== layer || pos === undefined || size === undefined ? [] : [side > 0 ? pos[across] + size[across] - 1 : pos[across]];
    });
    return side > 0 ? Math.max(...edges) : Math.min(...edges);
  };
  const ends = new Map<string, Array<readonly [rel: Relationship, end: boolean, toward: number, rank: number]>>();
  for (const [rel, rank] of ranks) {
    for (const [box, partner, end] of [
      [rel.source, rel.target, false],
      [rel.target, rel.source, true],
    ] as const) {
      const toward = Math.sign(midAlong(layout, partner, isLR) - midAlong(layout, box, isLR));
      ends.set(box, [...(ends.get(box) ?? []), [rel, end, toward, rank]]);
    }
  }
  const spread = isLR ? ARRIVAL_SPREAD : EXIT_SPREAD;
  const cells = new Map<Relationship, [number, number]>();
  for (const [box, list] of ends) {
    const [x, y] = must(layout.positions.get(box));
    const [w, h] = must(layout.sizes.get(box));
    const first = isLR ? y + 1 : x + 1;
    const last = isLR ? y + h - 2 : x + w - 2;
    const taken = [...(held.get(box) ?? [])];
    const open = Array.from({ length: Math.max(0, last - first + 1) }, (_, k) => first + k).filter(
      (cell) => !taken.includes(cell) && (!isLR || seatFree(layout, box, side, cell))
    );
    const ordered = [...list].sort((a, b) => a[2] - b[2] || (a[2] > 0 ? b[3] - a[3] : a[3] - b[3]));
    const left = ordered.filter(([, , toward]) => toward < 0).length;
    const mid = isLR ? wantedSeat(layout, box, 0) : x + Math.floor(w / 2);
    const fan = fanCells(ordered.length, spread);
    const wanted = (j: number): number =>
      taken.length === 0 ? mid + fan[j] : j < left ? Math.min(...taken) - spread * (left - j) : Math.max(...taken) + spread * (j - left + 1);
    const chosen = ordered.map((_, j) => {
      const want = wanted(j);
      const nearest = [...open].sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || Math.abs(b - mid) - Math.abs(a - mid))[0];
      if (nearest !== undefined) open.splice(open.indexOf(nearest), 1);
      return nearest ?? Math.max(first, Math.min(last, want));
    });
    // Whatever cells were free, the ends keep the order that nests them.
    chosen.sort((a, b) => a - b);
    ordered.forEach(([rel, end], j) => {
      const pair = cells.get(rel) ?? [0, 0];
      pair[end ? 1 : 0] = chosen[j];
      cells.set(rel, pair);
    });
  }
  const detours = new Map<Relationship, Detour>();
  for (const [rel, rank] of ranks) {
    const [exit, arrival] = must(cells.get(rel));
    detours.set(rel, { ride: farEdge(must(layout.layerOf.get(rel.source))) + side * (2 + rank), side, exit, arrival });
  }
  return detours;
}

export interface DetourPath {
  readonly points: readonly RowCol[];
  readonly headings: readonly Toward[];
  // The way the box lies from either end.
  readonly facing: Toward;
}

// A detour leaves its wall past the layer's far side, rides along it past the boxes in between, and comes back in.
export function detourPath(rel: Relationship, detour: Detour, layout: Layout, isLR: boolean): DetourPath {
  const { ride, side, exit, arrival } = detour;
  const end = (name: string, cell: number): RowCol => {
    const [x, y] = must(layout.positions.get(name));
    const [w, h] = must(layout.sizes.get(name));
    return isLR ? [cell, side > 0 ? x + w : x - 1] : [side > 0 ? y + h : y - 1, cell];
  };
  const [r1, c1] = end(rel.source, exit);
  const [r2, c2] = end(rel.target, arrival);
  if (isLR) {
    return {
      points: [[r1, c1], [r1, ride], [r2, ride], [r2, c2]],
      headings: [side > 0 ? "right" : "left", r2 > r1 ? "down" : "up", side > 0 ? "left" : "right"],
      facing: side > 0 ? "left" : "right",
    };
  }
  return {
    points: [[r1, c1], [ride, c1], [ride, c2], [r2, c2]],
    headings: [side > 0 ? "down" : "up", c2 > c1 ? "right" : "left", side > 0 ? "up" : "down"],
    facing: side > 0 ? "up" : "down",
  };
}
