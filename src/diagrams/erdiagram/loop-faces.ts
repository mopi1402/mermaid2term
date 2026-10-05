import type { ERDiagram, Layout, Relationship } from "./model.js";
import { stampedWidth } from "../../canvas/chip.js";
import { clampAcross, clampOffset, MARKER_ACROSS, sideRow } from "./metrics.js";

// What choosing a loop's faces reads: the layout once placed, or before placement its layers alone.
export type Seating = Pick<Layout, "positions" | "sizes" | "layerOf" | "layers" | "offsets" | "isLR">;

// Where a self relation loops: the flank it leaves by and the face it comes back through, +1 being right and below.
export interface LoopFaces {
  side: 1 | -1;
  down: 1 | -1;
}

export interface Partnered {
  index: number;
  exit: boolean;
  across: number;
  down: number;
}

// From one loop's entry on the face it comes back through to the next one's, a figure and a blank column apart.
export const NEST_STEP = MARKER_ACROSS + 1;

// Each other end of the entity and the face it meets it on: down the page a partner in a later layer comes in from
// below and one of the same layer on a flank, across the page the other way round. Before placement a partner of
// the same layer stands beside by its order in the layer.
export function partners(rel: Relationship, index: number, seating: Seating, diagram: ERDiagram): Partnered[] {
  const name = rel.entity1;
  const own = seating.layerOf.get(name);
  if (own === undefined) return [];
  const at = seating.positions.get(name);
  const order = (who: string, layer: number): number => seating.layers[layer]?.indexOf(who) ?? 0;
  const found: Partnered[] = [];
  diagram.relationships.forEach((other, j) => {
    if (j === index || other.entity1 === other.entity2) return;
    const exit = other.entity1 === name;
    if (!exit && other.entity2 !== name) return;
    const partner = exit ? other.entity2 : other.entity1;
    const layer = seating.layerOf.get(partner);
    if (layer === undefined) return;
    const there = seating.positions.get(partner);
    if (at !== undefined && there === undefined) return;
    const beside =
      at === undefined || there === undefined
        ? Math.sign(order(partner, layer) - order(name, own))
        : Math.sign(seating.isLR ? there[1] - at[1] : there[0] - at[0]);
    const sign = layer === own ? beside : Math.sign(layer - own);
    const acrossFace = seating.isLR === (layer === own) ? 0 : sign;
    found.push({ index: j, exit, across: acrossFace, down: acrossFace === 0 ? sign : 0 });
  });
  return found;
}

// A figure's width in from the corner, so the loop's fork keeps a column of wall beside it; the k-th loop of a nest
// comes back a figure further from the corner.
export const entryAt = (x: number, w: number, side: number, k = 0): number =>
  (side > 0 ? Math.max(x + 1, x + w - 4) : Math.min(x + w - 2, x + 3)) - side * NEST_STEP * k;

// The columns the other ends stand on along the face the loop would come back through.
export function seatsOn(met: Partnered[], down: number, seating: Seating, x: number, w: number): number[] {
  const mid = x + Math.floor(w / 2);
  return met
    .filter((p) => p.down === down)
    .map((p) => mid + clampAcross((p.exit ? seating.offsets.exit : seating.offsets.arrival).get(p.index) ?? 0, w));
}

// The rows, from the box's top, the other ends on a flank wall stand on.
export function rowsOn(met: Partnered[], across: number, seating: Seating, h: number): number[] {
  return met
    .filter((p) => p.across === across)
    .map((p) => sideRow(0, h) + clampOffset((p.exit ? seating.offsets.exit : seating.offsets.arrival).get(p.index) ?? 0, h));
}

// The loop comes back beyond every other end of that face, its run crossing none of their lines.
export const clearOf = (seats: number[], entry: number, side: number): boolean =>
  seats.every((col) => (side > 0 ? col <= entry - 3 : col >= entry + 3));

// A nest keeps a blank column, and the half of any label hung on the other end's run, between that end and its
// outermost figure; a lone loop may stand figure to figure.
function landsClear(met: Partnered[], down: number, seating: Seating, diagram: ERDiagram, x: number, w: number, side: number, count: number): boolean {
  const entry = entryAt(x, w, side, count - 1);
  const seats = seatsOn(met, down, seating, x, w);
  if (count === 1) return clearOf(seats, entry, side);
  const onFace = met.filter((p) => p.down === down);
  return seats.every((col, at) => {
    const label = diagram.relationships[onFace[at].index].label;
    const half = label === "" ? 1 : Math.max(1, Math.ceil(stampedWidth(label) / 2));
    return side > 0 ? col + half <= entry - 3 : col - half >= entry + 3;
  });
}

// A nest of `count` loops leaves by the flank no partner stands on and comes back below, or above when only that
// face keeps clear of the other ends.
export function loopFaces(rel: Relationship, index: number, seating: Seating, diagram: ERDiagram, count = 1): LoopFaces {
  const met = partners(rel, index, seating, diagram);
  const [x] = seating.positions.get(rel.entity1) ?? [0, 0];
  const [w] = seating.sizes.get(rel.entity1) ?? [0, 0];
  const flanked = (across: number): boolean => met.some((p) => p.across === across);
  const side = flanked(1) && !flanked(-1) ? -1 : 1;
  const lands = (down: number): boolean => landsClear(met, down, seating, diagram, x, w, side, count);
  return { side, down: !lands(1) && lands(-1) ? -1 : 1 };
}

// Whether a nest of `count` loops finds a face to come back through clear of the other ends.
export function nestLands(rel: Relationship, index: number, seating: Seating, diagram: ERDiagram, count: number): boolean {
  const met = partners(rel, index, seating, diagram);
  const [w] = seating.sizes.get(rel.entity1) ?? [0, 0];
  const { side } = loopFaces(rel, index, seating, diagram, count);
  return [1, -1].some((down) => landsClear(met, down, seating, diagram, 0, w, side, count));
}
