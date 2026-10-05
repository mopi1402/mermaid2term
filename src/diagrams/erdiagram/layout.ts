import type { ERDiagram, PinnedEnds, EndOffsets, Layout } from "./model.js";
import { EMPTY_SIZE } from "../../canvas/canvas.js";
import { labelLines, widestLabelLine } from "../../text/labels.js";
import { must } from "../../must.js";
import { planChips } from "./chips.js";
import { stampedWidth } from "../../canvas/chip.js";
import { BT, CORRIDOR_STEP, LR, MARGIN, MARKER_ALONG, MIN_STRIDE, NO_RANK_SPACING, RL, STACK_GAP, type RankSpacing } from "./metrics.js";
import { adjacentDrops, computeEndOffsets, packLanes } from "./offsets.js";
import { skipEdges } from "./geometry.js";
import { assignLayers, laysFlat } from "./layers.js";
import { pinBuriedEnds } from "./styling.js";
import { straightenDrops } from "./straighten.js";
import { seatOffRules } from "./rule-seats.js";
import { loopRoom } from "./self-loop.js";
import { nestReaches, seatNests, type NestReach } from "./loop-nest.js";
import { foldChainIntoBands } from "./chain-fold.js";
import { relationGaps, sizeBoxes } from "./spacing.js";
import { pairKey } from "../@common/box-diagram.js";
import { partsOf } from "../@common/parts.js";
import { stackLayered } from "../@common/stack.js";
import { centredOffset } from "../../text/width.js";

// What every phase of the layout reads: the diagram, the layout it fills, and the spacing it was asked for.
interface Laying {
  readonly diagram: ERDiagram;
  readonly layout: Layout;
  readonly gap: number;
  readonly ranks: RankSpacing;
  readonly pinned: Map<number, PinnedEnds> | undefined;
  // The lanes a band between two layers bends its runs through.
  readonly bandBends: (band: number) => number;
  // How far past its box each nest of self loops reaches, kept clear of the rest.
  readonly nests: ReadonlyMap<string, NestReach>;
}

export function computeLayout(
  diagram: ERDiagram,
  paddingX: number,
  gap: number,
  lieFlat: boolean,
  bands = 1,
  blockSizes: Map<string, [number, number]> | undefined = undefined,
  pinned: Map<number, PinnedEnds> | undefined = undefined,
  ranks: RankSpacing = NO_RANK_SPACING
): Layout {
  let layers = assignLayers(diagram);
  const positions = new Map<string, [number, number]>();
  const sizes = new Map<string, [number, number]>();
  const layerOf = new Map<string, number>();
  const emptyOffsets: EndOffsets = { exit: new Map(), arrival: new Map() };
  if (layers.length === 0)
    return { positions, sizes, width: EMPTY_SIZE, height: EMPTY_SIZE, layerOf, layers, offsets: emptyOffsets, isLR: false, airy: false, slots: undefined, corridorInset: 0, chips: undefined };

  if (diagram.direction === BT || diagram.direction === RL) layers = [...layers].reverse();
  layers.forEach((layer, index) => {
    for (const name of layer) layerOf.set(name, index);
  });
  let isLR =
    diagram.direction === LR || diagram.direction === RL || (!diagram.directionDeclared && lieFlat && laysFlat(diagram, layers, layerOf));
  let slots: Map<string, number> | undefined;
  const airy = false;

  if (isLR && !diagram.directionDeclared && layers.every((layer) => layer.length === 1)) {
    const folded = foldChainIntoBands(layers, layerOf, bands);
    if (folded !== undefined) {
      ({ layers, slots } = folded);
      isLR = false;
    }
  }

  sizeBoxes(diagram, layerOf, sizes, slots, blockSizes, paddingX, gap, airy, isLR);
  const offsets = computeEndOffsets(diagram, layerOf, layers, isLR);

  if (pinned !== undefined) pinBuriedEnds(diagram, pinned, layerOf, sizes, offsets, isLR);
  seatOffRules(diagram, layerOf, sizes, offsets, isLR, new Set(blockSizes?.keys()), pinned);
  seatNests(diagram, { sizes, layerOf, layers, offsets, isLR }, new Set(blockSizes?.keys()));
  const nests = nestReaches(diagram, { sizes, layerOf, layers, offsets, isLR });

  const { pairGap, crossLayerGap } = relationGaps(diagram, layerOf, isLR ? (ranks.gap ?? gap) : gap, isLR);

  const layout: Layout = { positions, sizes, width: 0, height: 0, layerOf, layers, offsets, isLR, airy, slots, corridorInset: 0, chips: undefined };

  const bandBends = (band: number): number => packLanes(diagram, layout, offsets, isLR).counts.get(band) ?? 0;

  const laying: Laying = { diagram, layout, gap, ranks, pinned, bandBends, nests };

  if (isLR) {
    layOutAcross(laying, crossLayerGap);
    makeLoopRoom(diagram, layout);
    return layout;
  }

  const asideRoom = asideRoomOf(diagram, layerOf, sizes);
  // A nest keeps its flank's neighbour in the layer as far off as it reaches.
  for (const layer of layers)
    layer.forEach((name, at) => {
      const reach = nests.get(name);
      const before = reach === undefined || reach.faces.side > 0 ? name : layer.at(at - 1);
      if (reach !== undefined && before !== undefined) asideRoom.set(before, Math.max(asideRoom.get(before) ?? 0, reach.across));
    });
  if (slots !== undefined) placeInSlots(laying, slots, pairGap, asideRoom);
  else placeInZones(laying, pairGap, asideRoom);

  straightenDrops(diagram, layout, offsets, isLR, pinned);
  stackLayers(laying);
  openCorridor(laying);
  makeLoopRoom(diagram, layout);
  return layout;
}

// A left to right drawing: each layer a column, its entities stacked and centred down it, the columns as far apart
// as their bends need.
function layOutAcross({ diagram, layout, ranks, pinned, bandBends, nests }: Laying, crossLayerGap: number): void {
  const { positions, sizes, layers, layerOf, offsets, isLR } = layout;
  const stack = STACK_GAP + ranks.stackRows;
  let tallest = 0;
  const heights = new Map<string[], number>();
  for (const layer of layers) {
    let rowY = MARGIN;
    layer.forEach((name, at) => {
      const [, h] = must(sizes.get(name));
      positions.set(name, [0, rowY]);
      const next = layer.at(at + 1);
      rowY += h + (next === undefined ? 0 : Math.max(stack, nestAlong(nests, name, 1), nestAlong(nests, next, -1)));
    });
    heights.set(layer, rowY - MARGIN);
    tallest = Math.max(tallest, rowY + MARGIN);
  }
  layout.height = tallest;
  for (const layer of layers) {
    const layerHeight = must(heights.get(layer));
    const room = layout.height - 2 * MARGIN - layerHeight;
    const shiftBy = (by: number): void => {
      for (const name of layer) {
        const [x, y] = must(positions.get(name));
        positions.set(name, [x, y + by]);
      }
    };
    const offset = Math.floor(room / 2);
    shiftBy(offset);
    // A row off the middle when that lines more runs up straight, as a seat stepped off a rule asks.
    const straight = (): number => adjacentDrops(diagram, layout, offsets, isLR).filter(({ span }) => span[0] === span[1]).length;
    let best = 0;
    let most = -1;
    for (const by of [0, -1, 1].filter((by) => offset + by >= 0 && offset + by <= room)) {
      shiftBy(by);
      const count = straight();
      if (count > most) [best, most] = [by, count];
      shiftBy(-by);
    }
    shiftBy(best);
  }

  straightenDrops(diagram, layout, offsets, isLR, pinned);
  const widthOf = (name: string): number => must(sizes.get(name))[0];
  const seat = (name: string, x: number): void => {
    const [, y] = must(positions.get(name));
    positions.set(name, [x, y]);
  };
  const stride = (index: number): number =>
    Math.max(crossLayerGap, bandBends(index) * 2 + MIN_STRIDE, ...layers[index].map((name) => nestAcross(nests, name, 1)), ...(layers.at(index + 1) ?? []).map((name) => nestAcross(nests, name, -1)));
  layout.width = stackLayered(layers, widthOf, seat, stride, MARGIN, MARGIN);

  const lrCorridorShift = skipEdges(diagram, layerOf).length * CORRIDOR_STEP;
  if (lrCorridorShift > 0) {
    for (const [name, [x, y]] of positions) positions.set(name, [x, y + lrCorridorShift]);
    layout.height += lrCorridorShift;
  }
}

// The rows a nest of loops takes past its box's face `down`, or the columns past its flank `side`, none when it has no nest there.
const nestAlong = (nests: ReadonlyMap<string, NestReach>, name: string, down: number): number => {
  const reach = nests.get(name);
  return reach?.faces.down === down ? reach.along : 0;
};
const nestAcross = (nests: ReadonlyMap<string, NestReach>, name: string, side: number): number => {
  const reach = nests.get(name);
  return reach?.faces.side === side ? reach.across : 0;
};

// How far each entity's relations to a neighbour layer hang past its half: the label, or the markers.
function asideRoomOf(diagram: ERDiagram, layerOf: ReadonlyMap<string, number>, sizes: ReadonlyMap<string, [number, number]>): Map<string, number> {
  const asideRoom = new Map<string, number>();
  for (const rel of diagram.relationships) {
    const a = layerOf.get(rel.entity1);
    const b = layerOf.get(rel.entity2);
    if (a === undefined || b === undefined || a === b || Math.abs(a - b) >= 2) continue;
    for (const name of [rel.entity1, rel.entity2]) {
      const [w] = must(sizes.get(name));
      const overhang = Math.max(
        rel.label === "" ? 0 : widestLabelLine(rel.label) + 2 - Math.ceil(w / 2),
        MARKER_ALONG + 1 - Math.ceil(w / 2),
        MARKER_ALONG + 1 - Math.ceil(w / 2)
      );
      asideRoom.set(name, Math.max(asideRoom.get(name) ?? 0, overhang));
    }
  }
  return asideRoom;
}

// A chain folded onto a grid: every entity in its slot, the slots as wide as the widest entity.
function placeInSlots({ layout, gap }: Laying, slots: ReadonlyMap<string, number>, pairGap: ReadonlyMap<string, number>, asideRoom: ReadonlyMap<string, number>): void {
  const { positions, sizes } = layout;
  const slotWidth = Math.max(...[...sizes.values()].map(([w]) => w));
  const slotGap = Math.max(gap, ...pairGap.values(), ...[...asideRoom.values()]);
  const pitch = slotWidth + slotGap;
  let lastSlot = 0;
  for (const [name, slot] of slots) {
    positions.set(name, [MARGIN + slot * pitch, 0]);
    lastSlot = Math.max(lastSlot, slot);
  }
  layout.width = MARGIN * 2 + lastSlot * pitch + slotWidth;
}

// Each layer a row, its entities side by side, each schema in a zone of its own; a lone child under its one parent.
function placeInZones({ diagram, layout, gap }: Laying, pairGap: ReadonlyMap<string, number>, asideRoom: ReadonlyMap<string, number>): void {
  const { positions, sizes, layers, layerOf } = layout;
  const rowWidth = (row: string[]): number =>
    row.reduce((sum, name, at) => {
      const next = row[at + 1];
      const [w] = must(sizes.get(name));
      return sum + (next === undefined ? w : w + Math.max(pairGap.get(pairKey(name, next)) ?? gap, asideRoom.get(name) ?? 0));
    }, 0);
  const place = (row: string[], left: number, width: number): void => {
    let columnX = left + Math.max(0, Math.floor((width - rowWidth(row)) / 2));
    row.forEach((name, at) => {
      const [w] = must(sizes.get(name));
      positions.set(name, [columnX, 0]);
      const next = row[at + 1];
      columnX += next === undefined ? w : w + Math.max(pairGap.get(pairKey(name, next)) ?? gap, asideRoom.get(name) ?? 0);
    });
  };
  // Schemas no line joins keep a zone each, side by side and twice as far apart as siblings, as mermaid lays its components apart.
  const zones = schemaZones(diagram, layers);
  const loose = (layer: string[]): boolean => layer.every((name) => !zones.some((zone) => zone.has(name)));
  const zoneWidths = zones.map((zone) => Math.max(...layers.map((layer) => rowWidth(layer.filter((name) => zone.has(name))))));
  const zoneGap = (at: number): number => {
    const edge = [...zones[at]].map((name) => asideRoom.get(name) ?? 0);
    return Math.max(2 * gap, ...edge, ...[...zones[at + 1]].map((name) => asideRoom.get(name) ?? 0));
  };
  const zonesWidth = zoneWidths.reduce((sum, w, at) => sum + w + (at + 1 < zones.length ? zoneGap(at) : 0), 0);
  layout.width = Math.max(zonesWidth, ...layers.filter(loose).map(rowWidth)) + 2 * MARGIN;
  let zoneX = MARGIN + centredOffset(layout.width - 2 * MARGIN, zonesWidth);
  zones.forEach((zone, at) => {
    for (const layer of layers) place(layer.filter((name) => zone.has(name)), zoneX, zoneWidths[at]);
    zoneX += zoneWidths[at] + (at + 1 < zones.length ? zoneGap(at) : 0);
  });
  for (const layer of layers) if (loose(layer)) place(layer, MARGIN, layout.width - 2 * MARGIN);
  layers.forEach((layer, index) => {
    if (index === 0 || layer.length !== 1) return;
    const [name] = layer;
    const parents = new Set<string>();
    for (const rel of diagram.relationships) {
      const other = rel.entity1 === name ? rel.entity2 : rel.entity2 === name ? rel.entity1 : undefined;
      if (other !== undefined && layerOf.get(other) === index - 1) parents.add(other);
    }
    if (parents.size !== 1) return;
    const [parent] = parents;
    const [px] = must(positions.get(parent));
    const [pw] = must(sizes.get(parent));
    const [w] = must(sizes.get(name));
    const wanted = px + Math.floor(pw / 2) - Math.floor(w / 2);
    const [, y] = must(positions.get(name));
    positions.set(name, [Math.max(MARGIN, Math.min(wanted, layout.width - MARGIN - w)), y]);
  });
}

// The rows down the page, each layer as tall as its tallest entity, each band as deep as its chips and bends.
function stackLayers({ diagram, layout, ranks, bandBends, nests }: Laying): void {
  const { positions, sizes, layers, layerOf, offsets, isLR } = layout;
  const chips = planChips(diagram, layout, offsets, isLR);
  layout.chips = chips;
  // Each band owes its chips the rows of the tallest, one per row a `<br>` breaks it into.
  const topBands = new Map<number, number>();
  const bottomBands = new Map<number, number>();
  diagram.relationships.forEach((rel, index) => {
    const chip = chips.get(index);
    if (chip === undefined) return;
    const band = Math.min(must(layerOf.get(rel.entity1)), must(layerOf.get(rel.entity2)));
    const bands = chip.top ? topBands : bottomBands;
    bands.set(band, Math.max(bands.get(band) ?? 0, labelLines(rel.label)));
  });
  const heightOf = (name: string): number => must(sizes.get(name))[1];
  const seat = (name: string, y: number): void => {
    const [x] = must(positions.get(name));
    positions.set(name, [x, y]);
  };
  const stride = (index: number): number => {
    const lanes = bandBends(index);
    const rows = Math.max(lanes > 0 ? 1 : 0, topBands.get(index) ?? 0) + lanes + (bottomBands.get(index) ?? 0);
    const nested = Math.max(0, ...layers[index].map((name) => nestAlong(nests, name, 1)), ...(layers.at(index + 1) ?? []).map((name) => nestAlong(nests, name, -1)));
    return Math.max(2 * MARKER_ALONG + Math.max(1, rows) + ranks.rankRows, nested);
  };
  layout.height = stackLayered(layers, heightOf, seat, stride, MARGIN, MARGIN);
}

// The corridor left of the drawing that the runs skipping a layer take, wide enough for their labels.
function openCorridor({ diagram, layout }: Laying): void {
  const { positions, layerOf } = layout;
  const skips = skipEdges(diagram, layerOf);
  let inset = 0;
  let halfRight = 0;
  for (const index of skips) {
    const rel = diagram.relationships[index];
    if (rel.label === "") continue;
    const chip = stampedWidth(rel.label);
    inset = Math.max(inset, Math.floor((chip - 1) / 2));
    halfRight = Math.max(halfRight, chip - Math.floor((chip - 1) / 2));
  }
  layout.corridorInset = inset;
  let corridorShift = Math.max(inset + skips.length * CORRIDOR_STEP, inset + halfRight + 1, skips.length > 0 ? inset + MARKER_ALONG + 1 : 0);
  if (skips.length === 0) corridorShift = 0;
  if (corridorShift > 0) {
    for (const [name, [x, y]] of positions) positions.set(name, [x + corridorShift, y]);
    if (layout.chips !== undefined) for (const chip of layout.chips.values()) chip.at += corridorShift;
    layout.width += corridorShift;
  }
}

// A loop leaving by the left flank or coming back from above moves the whole drawing clear of the canvas edge.
function makeLoopRoom(diagram: ERDiagram, layout: Layout): void {
  const [right, down] = loopRoom(diagram, layout);
  if (right === 0 && down === 0) return;
  for (const [name, [x, y]] of layout.positions) layout.positions.set(name, [x + right, y + down]);
  if (layout.chips !== undefined) for (const chip of layout.chips.values()) chip.at += right;
  layout.width += right;
  layout.height += down;
}

// The schemas no relation joins, in the order their first entity is met, a loose entity being none of them.
function schemaZones(diagram: ERDiagram, layers: string[][]): Array<Set<string>> {
  const joined = new Set(diagram.relationships.flatMap((rel) => [rel.entity1, rel.entity2]));
  const parts = partsOf(layers.flat(), diagram.relationships.map((rel): [string, string] => [rel.entity1, rel.entity2]));
  return parts.filter((part) => part.some((name) => joined.has(name))).map((part) => new Set(part));
}
