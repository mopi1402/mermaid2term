import { type Layout, type Relationship } from "./model.js";
import { EMPTY_SIZE } from "../../canvas/canvas.js";
import { labelLines, widestLabelLine } from "../../text/labels.js";
import { must } from "../../must.js";
import { bfsLayers } from "../../graph/layout/ordering/bfs-layers.js";
import { EXIT_SPREAD, LABEL_ROOM, LAYER_GAP, MARGIN, MIN_EDGE_GAP, acrossRoom, exitRuns, tightRoom } from "./metrics.js";
import { fanCells } from "../@common/fans.js";
import { stampedWidth } from "../../canvas/chip.js";
import { detourRanks, fanBends, rideRoomOf, type FanRun } from "./geometry.js";
import { pairKey, sameLayerGaps } from "../@common/box-diagram.js";
import { stackLayered } from "../@common/stack.js";
import { partsOf } from "../@common/parts.js";

const byWant = (a: number | undefined, b: number | undefined): number =>
  a === undefined || b === undefined ? (a === b ? 0 : a === undefined ? 1 : -1) : a - b;

// The boxes of one part in the order they chain, from the end that comes first: a part that is no chain keeps `first`'s order.
function chainOrder(part: string[], pairs: readonly (readonly [string, string])[], first: (a: string, b: string) => number): string[] {
  const sorted = [...part].sort(first);
  if (part.length < 3) return sorted;
  const kin = new Map<string, Set<string>>(part.map((name) => [name, new Set<string>()]));
  for (const [one, two] of pairs) {
    if (one === two || !kin.has(one) || !kin.has(two)) continue;
    must(kin.get(one)).add(two);
    must(kin.get(two)).add(one);
  }
  const links = [...kin.values()].reduce((sum, set) => sum + set.size, 0) / 2;
  const start = sorted.find((name) => must(kin.get(name)).size === 1);
  if (links !== part.length - 1 || [...kin.values()].some((set) => set.size > 2) || start === undefined) return sorted;
  const chain = [start];
  for (let at = start, next = [...must(kin.get(at))][0]; next !== undefined; ) {
    chain.push(next);
    const [after] = [...must(kin.get(next))].filter((name) => name !== at);
    at = next;
    next = after;
  }
  return chain;
}

function placeAlong(
  relationships: Relationship[],
  layers: string[][],
  alongOf: (name: string) => number,
  gapBetween: (a: string, b: string | undefined) => number,
  midOf: (name: string) => number
): Map<string, number> {
  const starts = new Map<string, number>();
  const pairs = relationships.map((rel): readonly [string, string] => [rel.source, rel.target]);
  const centreOf = (name: string): number => must(starts.get(name)) + midOf(name);
  const placeLayer = (layer: string[], beside: ReadonlySet<string>): void => {
    const wanted = new Map<string, number | undefined>();
    for (const name of layer) {
      const kin = relationships.flatMap((rel) => {
        if (rel.source === name && beside.has(rel.target)) return [rel.target];
        if (rel.target === name && beside.has(rel.source)) return [rel.source];
        return [];
      });
      const centres = kin.map(centreOf);
      const kept = starts.has(name) ? centreOf(name) : undefined;
      wanted.set(name, centres.length === 0 ? kept : centres.reduce((sum, c) => sum + c, 0) / centres.length);
    }
    // A relation within the layer runs straight from one wall to the other, so the boxes it joins stand side by side
    // with nothing between them: they are placed as one run, at the mean of what they want, in the order they chain.
    const order = partsOf(layer, pairs).flatMap((part, index) => {
      const wants = part.flatMap((name) => wanted.get(name) ?? []);
      const want = wants.length === 0 ? undefined : wants.reduce((sum, w) => sum + w, 0) / wants.length;
      return chainOrder(part, pairs, (a, b) => byWant(wanted.get(a), wanted.get(b))).map((name, rank) => ({ name, want, index, rank }));
    });
    order.sort((a, b) => byWant(a.want, b.want) || a.index - b.index || a.rank - b.rank);
    let cursor = Number.NEGATIVE_INFINITY;
    for (let g = 0; g < order.length; ) {
      const want = order[g].want;
      let h = g;
      while (h + 1 < order.length && order[h + 1].want === want) h += 1;
      const group = order.slice(g, h + 1).map((o) => o.name);
      const span = group.reduce((sum, name, k) => sum + alongOf(name) + gapBetween(name, group[k + 1]), 0);
      let at = want === undefined ? (Number.isFinite(cursor) ? cursor : 0) : Math.max(cursor, Math.round(want) - Math.floor(span / 2));
      group.forEach((name, k) => {
        starts.set(name, at);
        at += alongOf(name) + gapBetween(name, group[k + 1]);
      });
      cursor = at + gapBetween(group[group.length - 1], order[h + 1]?.name);
      g = h + 1;
    }
  };
  const last = layers.length - 1;
  layers.forEach((layer, index) => placeLayer(layer, new Set(index === 0 ? [] : (layers[index - 1]))));
  for (let index = last - 1; index >= 0; index--) placeLayer(layers[index], new Set(layers[index + 1]));
  for (let index = 1; index <= last; index++) placeLayer(layers[index], new Set(layers[index - 1]));
  const least = Math.min(...starts.values());
  for (const [name, at] of starts) starts.set(name, at - least + MARGIN);
  return starts;
}

export function layoutItems(
  names: string[],
  sizes: Map<string, [number, number]>,
  relationships: Relationship[],
  isLR: boolean,
  gap: number,
  airyLabels: boolean,
  stems: ReadonlyMap<string, number> = new Map()
): Layout {
  // The SOURCE stands over the target whatever the marker, as dagre reads it: `classA --|> classB` puts A on top.
  const layers = bfsLayers(names, relationships.map((rel) => [rel.source, rel.target]));
  const positions = new Map<string, [number, number]>();
  const layerOf = new Map<string, number>();
  if (layers.length === 0) return { positions, sizes, width: EMPTY_SIZE, height: EMPTY_SIZE, layerOf, frames: [], loops: new Map() };

  layers.forEach((layer, index) => {
    for (const name of layer) layerOf.set(name, index);
  });

  const pairGap = sameLayerGaps(relationships, (rel) => [rel.source, rel.target], layerOf, gap, (rel) =>
    Math.max(rel.label !== "" ? widestLabelLine(rel.label) + LABEL_ROOM : gap, gap, MIN_EDGE_GAP)
  );

  const alongOf = (name: string): number => (must(sizes.get(name)))[isLR ? 1 : 0];
  const acrossOf = (name: string): number => (must(sizes.get(name)))[isLR ? 0 : 1];
  const overhang = new Map<string, number>();
  for (const rel of relationships) {
    if (rel.label === "" || isLR) continue;
    const across = (layerOf.get(rel.source) ?? -1) !== (layerOf.get(rel.target) ?? -2);
    if (!across) continue;
    for (const end of [rel.source, rel.target]) {
      const reach = Math.max(0, Math.ceil((stampedWidth(rel.label) - alongOf(end)) / 2));
      overhang.set(end, Math.max(overhang.get(end) ?? 0, reach));
    }
  }
  const gapBetween = (a: string, b: string | undefined): number => {
    if (b === undefined) return 0;
    if (isLR) return LAYER_GAP;
    return Math.max(pairGap.get(pairKey(a, b)) ?? gap, (overhang.get(a) ?? 0) + (overhang.get(b) ?? 0) + 1);
  };
  // An item wider than its box (a self loop's room) centres its relations on the box's own stem, not on the room.
  const midOf = (name: string): number => stems.get(name) ?? Math.floor(alongOf(name) / 2);
  const starts = placeAlong(relationships, layers, alongOf, gapBetween, midOf);

  // The gap owes one row to every turn a fan has to make, worked out by the rule the drawing itself follows: two
  // runs that share columns cannot turn on one row, and a fork going both ways still turns on one.
  const middle = (name: string): number => (starts.get(name) ?? 0) + midOf(name);
  const crossing = relationships
    .map((rel, index) => ({ rel, index }))
    .filter(({ rel }) => (layerOf.get(rel.source) ?? -1) !== (layerOf.get(rel.target) ?? -2));
  const exits = new Map<number, number>();
  for (const source of new Set(crossing.map(({ rel }) => rel.source))) {
    const mine = crossing.filter(({ rel }) => rel.source === source);
    const cells = fanCells(mine.length, EXIT_SPREAD);
    [...mine]
      .sort((a, b) => middle(a.rel.target) - middle(b.rel.target) || a.index - b.index)
      .forEach(({ index }, j) => exits.set(index, cells[j]));
  }
  const runs: Array<[string, FanRun]> = crossing.map(({ rel, index }) => [
    rel.source,
    { index, exit: middle(rel.source) + (exits.get(index) ?? 0), to: middle(rel.target) },
  ]);
  const widestFan = 1 + Math.max(0, ...fanBends(runs).values());
  // A run whose two ends do not face each other turns, and where it turns is where its chip has to go.
  const bent = new Set(runs.filter(([, run]) => run.exit !== run.to).map(([, run]) => run.index));
  // Laid across the page, every gap is as wide as the widest relation in the diagram: the drawing reads as a grid and
  // no label ever sits short of air. Once the page runs out of width that comfort is dropped and each gap falls back
  // to what the relations CROSSING IT need, nothing more.
  const outRuns = exitRuns(relationships);
  const comfort = Math.max(gap, ...relationships.map((rel) => acrossRoom(rel, outRuns.get(rel.source) ?? 0)));
  const tightAfter = (layer: number): number => {
    let room = gap;
    for (const [at, rel] of relationships.entries()) {
      const from = layerOf.get(rel.source);
      const to = layerOf.get(rel.target);
      if (from === undefined || to === undefined || Math.abs(to - from) !== 1 || Math.min(from, to) !== layer) continue;
      room = Math.max(room, tightRoom(rel, outRuns.get(rel.source) ?? 0, bent.has(at)));
    }
    return room;
  };
  // Down the page a chip of several rows stands on the shaft, the gap it crosses one row longer per row it adds.
  const tallAfter = (layer: number): number =>
    Math.max(
      0,
      ...relationships.map((rel) => {
        const from = layerOf.get(rel.source) ?? -1;
        const to = layerOf.get(rel.target) ?? -1;
        return from !== to && Math.min(from, to) <= layer && Math.max(from, to) > layer ? labelLines(rel.label) - 1 : 0;
      })
    );
  // A relation within a layer that would cross a box of it rides past the layer, and the gap after it owes the rides.
  const ranks = detourRanks(relationships, layerOf, (name) => (starts.has(name) ? middle(name) : undefined));
  const rides = rideRoomOf(ranks, layerOf, isLR);
  const rideRoom = (layer: number): number => rides.get(layer) ?? 0;
  const gapAfter = (layer: number): number =>
    rideRoom(layer) + (!isLR ? LAYER_GAP + widestFan - 1 + tallAfter(layer) : airyLabels ? comfort : tightAfter(layer));

  let reach = 0;
  const seat = (name: string, across: number): void => {
    const along = must(starts.get(name));
    positions.set(name, isLR ? [across, along] : [along, across]);
    reach = Math.max(reach, along + alongOf(name));
  };
  const depth = stackLayered(layers, acrossOf, seat, gapAfter, MARGIN, MARGIN + rideRoom(layers.length - 1));
  const width = isLR ? depth : reach + MARGIN;
  const height = isLR ? reach + MARGIN : depth;

  return { positions, sizes, width, height, layerOf, frames: [], loops: new Map() };
}
