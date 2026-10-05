import type { ERDiagram, Relationship, EndOffsets, Layout } from "./model.js";
import { must, pushInto } from "../../must.js";
import { fanCells, stackedRows } from "../@common/fans.js";
import { stampedWidth } from "../../canvas/chip.js";
import { EXIT_SPREAD, KEY_SEP, markerStride, sideRow, SIDE_SIDE, clampAcross, clampOffset } from "./metrics.js";
function dropSpan(rel: Relationship, index: number, layout: Layout, offsets: EndOffsets, isLR: boolean): [number, number] | undefined {
  const source = layout.positions.get(rel.entity1);
  const target = layout.positions.get(rel.entity2);
  if (source === undefined || target === undefined) return undefined;
  const [sw, sh] = must(layout.sizes.get(rel.entity1));
  const [tw, th] = must(layout.sizes.get(rel.entity2));
  const axis = isLR ? 1 : 0;
  const extents = isLR ? [sh, th] : [sw, tw];
  const half = isLR ? [sideRow(0, sh), sideRow(0, th)] : [Math.floor(sw / 2), Math.floor(tw / 2)];
  const clamp = isLR ? clampOffset : clampAcross;
  const from = (source[axis]) + (half[0]) + clamp(offsets.exit.get(index) ?? 0, extents[0]);
  const to = (target[axis]) + (half[1]) + clamp(offsets.arrival.get(index) ?? 0, extents[1]);
  return [from, to];
}

interface AdjacentDrop {
  rel: Relationship;
  index: number;
  a: number;
  b: number;
  span: [number, number];
}

// Every relationship between two neighbouring layers, with the layers it joins and the span of its drop.
export function adjacentDrops(
  diagram: ERDiagram,
  layout: Layout,
  offsets: EndOffsets,
  isLR: boolean
): AdjacentDrop[] {
  const drops: AdjacentDrop[] = [];
  diagram.relationships.forEach((rel, index) => {
    const a = layout.layerOf.get(rel.entity1);
    const b = layout.layerOf.get(rel.entity2);
    if (a === undefined || b === undefined || a === b || Math.abs(a - b) >= 2) return;
    const span = dropSpan(rel, index, layout, offsets, isLR);
    if (span !== undefined) drops.push({ rel, index, a, b, span });
  });
  return drops;
}

export function packLanes(
  diagram: ERDiagram,
  layout: Layout,
  offsets: EndOffsets,
  isLR: boolean
): { lanes: Map<number, number>; counts: Map<number, number> } {
  const byBand = new Map<number, Drop[]>();
  for (const { index, a, b, span } of adjacentDrops(diagram, layout, offsets, isLR)) {
    if (span[0] === span[1]) continue;
    const band = Math.min(a, b);
    const list = byBand.get(band) ?? [];
    list.push({ index, lo: Math.min(...span), hi: Math.max(...span), from: span[0], to: span[1] });
    byBand.set(band, list);
  }
  const lanes = new Map<number, number>();
  const counts = new Map<number, number>();
  for (const [band, list] of byBand) {
    list.sort((p, q) => p.lo - q.lo);
    const spans = list.map((item): readonly [number, number] => [item.lo, item.hi]);
    stackedRows(spans, 1).forEach((lane, k) => lanes.set(list[k].index, lane));
    uncross(list, lanes);
    counts.set(band, Math.max(...list.map((item) => must(lanes.get(item.index)))) + 1);
  }
  return { lanes, counts };
}

interface Drop {
  index: number;
  lo: number;
  hi: number;
  from: number;
  to: number;
}

// Where two drops meet: each one's legs against the other's run, a lane lower down the page being a larger one.
function meetings(one: Drop, oneLane: number, two: Drop, twoLane: number): number {
  const legs = (drop: Drop, lane: number, run: Drop, runLane: number): number =>
    (runLane < lane && run.lo < drop.from && drop.from < run.hi ? 1 : 0) + (runLane > lane && run.lo < drop.to && drop.to < run.hi ? 1 : 0);
  return legs(one, oneLane, two, twoLane) + legs(two, twoLane, one, oneLane);
}

// Packing by the left end alone can seat two drops so they cross twice where the other order has them never meet:
// every pair that overlaps goes the way it meets least, each drop one lane under the lowest it must pass under.
function uncross(list: Drop[], lanes: Map<number, number>): void {
  const packed = (drop: Drop): number => must(lanes.get(drop.index));
  const under = new Map<Drop, Drop[]>(list.map((drop) => [drop, []]));
  for (const one of list) {
    for (const two of list) {
      if (packed(one) >= packed(two) || one.lo > two.hi + 1 || two.lo > one.hi + 1) continue;
      const kept = meetings(one, 0, two, 1) <= meetings(one, 1, two, 0);
      must(under.get(kept ? two : one)).push(kept ? one : two);
    }
  }
  const seated = new Map<Drop, number>();
  const seating = new Set<Drop>();
  const seat = (drop: Drop): number | undefined => {
    const known = seated.get(drop);
    if (known !== undefined) return known;
    if (seating.has(drop)) return undefined;
    seating.add(drop);
    let lane = 0;
    for (const over of must(under.get(drop))) {
      const above = seat(over);
      if (above === undefined) return undefined;
      lane = Math.max(lane, above + 1);
    }
    seated.set(drop, lane);
    return lane;
  };
  for (const drop of list) if (seat(drop) === undefined) return;
  for (const [drop, lane] of seated) lanes.set(drop.index, lane);
}

export function computeEndOffsets(diagram: ERDiagram, layerOf: Map<string, number>, layers: string[][], isLR: boolean): EndOffsets {
  const across = new Map<string, number>();
  for (const layer of layers) layer.forEach((name, at) => across.set(name, (at + 0.5) / layer.length));

  const AFTER = "after";
  const BEFORE = "before";
  interface LineEnd {
    index: number;
    exit: boolean;
    room: number;
    other: string;
  }
  const groups = new Map<string, LineEnd[]>();
  const land = (key: string, end: LineEnd): void => pushInto(groups, key, end);
  diagram.relationships.forEach((rel, index) => {
    if (rel.entity1 === rel.entity2) return;
    const a = layerOf.get(rel.entity1) ?? -1;
    const b = layerOf.get(rel.entity2) ?? -2;
    if (Math.abs(a - b) >= 2) return;
    const room1 = markerStride(isLR);
    const room2 = room1;
    if (a === b) {
      land(`${rel.entity1}${KEY_SEP}${SIDE_SIDE}`, { index, exit: true, room: room1, other: rel.entity2 });
      return;
    }
    land(`${rel.entity1}${KEY_SEP}${a < b ? AFTER : BEFORE}`, { index, exit: true, room: room1, other: rel.entity2 });
    land(`${rel.entity2}${KEY_SEP}${a < b ? BEFORE : AFTER}`, { index, exit: false, room: room2, other: rel.entity1 });
  });

  const offsets: EndOffsets = { exit: new Map(), arrival: new Map() };
  for (const ends of groups.values()) {
    if (ends.length <= 1) {
      for (const end of ends) (end.exit ? offsets.exit : offsets.arrival).set(end.index, 0);
      continue;
    }
    ends.sort((one, two) => (across.get(one.other) ?? 0) - (across.get(two.other) ?? 0) || one.index - two.index);
    let spread = Math.max(EXIT_SPREAD, ...ends.map((end) => end.room));
    if (!isLR) {
      const chip = (index: number): number => {
        const label = diagram.relationships[index].label;
        return label === "" ? 0 : stampedWidth(label);
      };
      for (let j = 1; j < ends.length; j++) {
        const one = ends[j - 1];
        const two = ends[j];
        if (one.other !== two.other || chip(one.index) === 0 || chip(two.index) === 0) continue;
        spread = Math.max(spread, Math.ceil((chip(one.index) + chip(two.index)) / 2) + 4);
      }
    }
    const cells = fanCells(ends.length, spread);
    ends.forEach((end, j) => (end.exit ? offsets.exit : offsets.arrival).set(end.index, cells[j]));
  }
  return offsets;
}
