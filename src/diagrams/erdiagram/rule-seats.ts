import type { Cardinality, ERDiagram, EndOffsets, Entity, PinnedEnds } from "./model.js";
import { must } from "../../must.js";
import { ruleRow } from "./attributes.js";
import { nestsOf } from "./loop-nest.js";
import { isMany } from "./entity-box.js";
import { clampOffset, KEY_SEP, sideRow } from "./metrics.js";

interface SideEnd {
  index: number;
  exit: boolean;
  card: Cardinality;
}

const MAX_GROWTH = 2;
const MAX_SHIFT = 3;

// A relation reaching a side wall never stands on the attribute rule, nor spreads a crow's claw past a corner: the
// ends of one face step together to the nearest rows that hold them, the box growing a row when none is left.
export function seatOffRules(
  diagram: ERDiagram,
  layerOf: Map<string, number>,
  sizes: Map<string, [number, number]>,
  offsets: EndOffsets,
  isLR: boolean,
  fixed: ReadonlySet<string>,
  pinned: Map<number, PinnedEnds> | undefined
): void {
  for (const [key, ends] of sideFaces(diagram, layerOf, isLR, pinned)) {
    const name = key.slice(0, key.indexOf(KEY_SEP));
    const entity = must(diagram.entities.get(name));
    if (ruleRow(entity) === undefined || fixed.has(name)) continue;
    const [w, h] = must(sizes.get(name));
    const offOf = (end: SideEnd): number => (end.exit ? offsets.exit : offsets.arrival).get(end.index) ?? 0;
    const holds = (height: number, shift: number): boolean =>
      ends.every((end) => clampOffset(offOf(end) + shift, height) === offOf(end) + shift && holdsSide(entity, height, offOf(end) + shift, end.card));
    const shifts = [0, ...Array.from({ length: MAX_SHIFT }, (_, k) => [k + 1, -(k + 1)]).flat()];
    for (let height = h; height <= h + MAX_GROWTH; height++) {
      const shift = shifts.find((s) => holds(height, s));
      if (shift === undefined) continue;
      sizes.set(name, [w, height]);
      for (const end of ends) (end.exit ? offsets.exit : offsets.arrival).set(end.index, offOf(end) + shift);
      break;
    }
  }
}

// Whether an end seated `off` rows from the middle of a side wall keeps off the rule, its claws inside the corners.
export function holdsSide(entity: Entity, height: number, off: number, card: Cardinality): boolean {
  const rule = ruleRow(entity);
  if (rule === undefined) return true;
  const row = sideRow(0, height) + off;
  const reach = isMany(card) ? 1 : 0;
  return row !== rule && row - reach >= 1 && row + reach <= height - 2;
}

// The ends that meet a box on a side wall, grouped by the face they share: the corridor's wall down the page, and the wall a self-loop leaves by.
function sideFaces(
  diagram: ERDiagram,
  layerOf: Map<string, number>,
  isLR: boolean,
  pinned: Map<number, PinnedEnds> | undefined
): Map<string, SideEnd[]> {
  const faces = new Map<string, SideEnd[]>();
  const land = (key: string, end: SideEnd): void => {
    faces.set(key, [...(faces.get(key) ?? []), end]);
  };
  const nests = nestsOf(diagram);
  diagram.relationships.forEach((rel, index) => {
    const a = layerOf.get(rel.entity1);
    const b = layerOf.get(rel.entity2);
    if (a === undefined || b === undefined || pinned?.has(index) === true) return;
    const face = (name: string, toward: string): string => `${name}${KEY_SEP}${toward}`;
    if (rel.entity1 === rel.entity2 && nests.has(rel.entity1)) return;
    if (rel.entity1 === rel.entity2) return land(face(rel.entity1, "loop"), { index, exit: true, card: rel.card1 });
    const skip = Math.abs(a - b) >= 2;
    if (skip ? isLR : (a === b) === isLR) return;
    const side = (one: number, two: number, alone: string): string => (skip ? "corridor" : one === two ? alone : one < two ? "after" : "before");
    land(face(rel.entity1, side(a, b, "out")), { index, exit: true, card: rel.card1 });
    land(face(rel.entity2, side(b, a, "in")), { index, exit: false, card: rel.card2 });
  });
  return faces;
}
