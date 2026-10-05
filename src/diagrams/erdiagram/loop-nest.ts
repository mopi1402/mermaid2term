import type { Cardinality, Entity, ERDiagram } from "./model.js";
import { must } from "../../must.js";
import { stampedWidth } from "../../canvas/chip.js";
import { labelLines } from "../../text/labels.js";
import { ruleRow } from "./attributes.js";
import { isMany } from "./entity-box.js";
import { sideRow } from "./metrics.js";
import { entryAt, loopFaces, NEST_STEP, nestLands, partners, rowsOn, type LoopFaces, type Seating } from "./loop-faces.js";

// The self relations of every entity that has more than one, in the order they are written: they nest.
export function nestsOf(diagram: ERDiagram): Map<string, number[]> {
  const loops = new Map<string, number[]>();
  diagram.relationships.forEach((rel, index) => {
    if (rel.entity1 === rel.entity2) loops.set(rel.entity1, [...(loops.get(rel.entity1) ?? []), index]);
  });
  return new Map([...loops].filter(([, indices]) => indices.length > 1));
}

// A nest round one box, from the box's corner: each loop's entry on the face it comes back through, the column it
// turns on and the row it rides, the first loop innermost and each next one turning past the one inside it and its
// label; `last` bounds the rows the nest takes past that face, its labels among them.
export interface NestShape {
  readonly entries: number[];
  readonly outers: number[];
  readonly rows: number[];
  readonly last: number;
}

export function nestShape(diagram: ERDiagram, indices: number[], faces: LoopFaces, w: number, h: number): NestShape {
  const { side, down } = faces;
  const entries: number[] = [];
  const outers: number[] = [];
  const rows: number[] = [];
  let last = 0;
  indices.forEach((index, k) => {
    const label = diagram.relationships[index].label;
    const chip = label === "" ? 0 : stampedWidth(label);
    const lines = label === "" ? 1 : labelLines(label);
    const above = Math.floor((lines - 1) / 2);
    const [toward, away] = down > 0 ? [above, lines - 1 - above] : [lines - 1 - above, above];
    const entry = entryAt(0, w, side, k);
    const prev = outers.at(-1);
    const own = side > 0 ? Math.max(w + 3, entry + chip + 4) : Math.min(-4, entry - chip - 4);
    entries.push(entry);
    outers.push(prev === undefined ? own : side > 0 ? Math.max(own, prev + 2) : Math.min(own, prev - 2));
    const row = k === 0 ? (down > 0 ? h + 1 : -2) + (indices.length > 1 ? down * toward : 0) : last + down * (1 + toward);
    rows.push(row);
    last = row + down * away;
  });
  return { entries, outers, rows, last };
}

const MAX_WIDEN = 48;
// A box holding a nest is at least as wide as its figures, the columns between them and a corner each side.
const nestWidth = (count: number): number => NEST_STEP * count + 3;
const MAX_DEEPEN = 24;

// Rows down a flank wall for the nest's exits, the first nearest the corner the loops come back past, each next
// one further up the wall; none on the name's rule, a claw kept inside the corners, and all of them between that
// corner and the other ends of the wall, so no run crosses the nest.
function exitRows(entity: Entity, h: number, cards: Cardinality[], down: number, taken: number[]): number[] | undefined {
  const rule = ruleRow(entity);
  const reach = cards.map((card) => (isMany(card) ? 1 : 0));
  const clear = (row: number, re: number): boolean => taken.every((t) => (down > 0 ? row - re > t + 2 : row + re < t - 2));
  const rows: number[] = [];
  let row = down > 0 ? h - 2 - reach[0] : 1 + reach[0];
  for (let k = 0; k < cards.length; k++) {
    if (k > 0) row -= down * (reach[k - 1] + reach[k] === 0 ? 1 : reach[k - 1] + reach[k] + 2);
    if (row === rule) row -= down;
    if (row - reach[k] < 1 || row + reach[k] > h - 2 || !clear(row, reach[k])) return undefined;
    rows.push(row);
  }
  return rows;
}

// Every box with a nest grows wide enough for each loop to come back through its own cell clear of the other ends,
// and tall enough for each to leave by its own row; its exits are seated there.
export function seatNests(diagram: ERDiagram, seating: Omit<Seating, "positions">, fixed: ReadonlySet<string>): void {
  const placed: Seating = { ...seating, positions: new Map() };
  const { sizes, offsets } = seating;
  for (const [name, indices] of nestsOf(diagram)) {
    const entity = must(diagram.entities.get(name));
    const first = indices[0];
    const rel = diagram.relationships[first];
    const [w0, h0] = must(sizes.get(name));
    if (!fixed.has(name)) {
      sizes.set(name, [Math.max(w0, nestWidth(indices.length)), h0]);
      for (let widen = 0; widen < MAX_WIDEN && !nestLands(rel, first, placed, diagram, indices.length); widen++) {
        const [w] = must(sizes.get(name));
        sizes.set(name, [w + 1, h0]);
      }
    }
    const [w] = must(sizes.get(name));
    const faces = loopFaces(rel, first, placed, diagram, indices.length);
    const met = partners(rel, first, placed, diagram);
    const cards = indices.map((index) => diagram.relationships[index].card1);
    for (let h = h0; h <= h0 + (fixed.has(name) ? 0 : MAX_DEEPEN); h++) {
      const rows = exitRows(entity, h, cards, faces.down, rowsOn(met, faces.side, placed, h));
      if (rows === undefined) continue;
      sizes.set(name, [w, h]);
      indices.forEach((index, k) => offsets.exit.set(index, rows[k] - sideRow(0, h)));
      break;
    }
  }
}

// How far past its walls each nest reaches before placement: the columns beyond its flank and the rows beyond the
// face it comes back through, a blank one kept before anything else.
export interface NestReach {
  readonly faces: LoopFaces;
  readonly across: number;
  readonly along: number;
}

export function nestReaches(diagram: ERDiagram, seating: Omit<Seating, "positions">): Map<string, NestReach> {
  const placed: Seating = { ...seating, positions: new Map() };
  const reaches = new Map<string, NestReach>();
  for (const [name, indices] of nestsOf(diagram)) {
    const [w, h] = must(seating.sizes.get(name));
    const faces = loopFaces(diagram.relationships[indices[0]], indices[0], placed, diagram, indices.length);
    const shape = nestShape(diagram, indices, faces, w, h);
    const outer = must(shape.outers.at(-1));
    reaches.set(name, { faces, across: (faces.side > 0 ? outer - w + 1 : -outer) + 1, along: faces.down > 0 ? shape.last - h + 2 : 1 - shape.last });
  }
  return reaches;
}
