import type { ERDiagram, EndOffsets, PinnedEnds, Spot } from "./model.js";
import { groupOf } from "./model.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { fillFrames, fillHex, inkFrame, reshapeFrame, styleBox } from "../../canvas/frame-style.js";
import { PROP_STROKE_DASHARRAY } from "../../source/css.js";
import { boxClassProps, boxProps } from "../@common/box-diagram.js";
import { slabBorders } from "../@common/borderless.js";
import { joggedOut, layBoxBand, padBoxes, type PaddedBox } from "../../canvas/fit-frame.js";
import {
  NODE,
  ROW_EVEN,
  ROW_ODD,
  wordKey,
} from "../../canvas/keys.js";
import { layBand } from "../../canvas/band.js";
import { sideRow } from "./metrics.js";
import { attributeOwners, nameRows, ruleRow } from "./attributes.js";
import { must } from "../../must.js";
import { slotInks, slotted, type ColorSlots, type SlotInks } from "../../paint/color-slots.js";

// mermaid's `getData` hands each entity the next colour slot in the order it was first named, a group's id none.
function entityIndex(diagram: ERDiagram, name: string): number | undefined {
  const index = [...diagram.entities.keys()].filter((key) => groupOf(diagram.groups, key) === undefined).indexOf(name);
  return index === -1 ? undefined : index;
}

function entitySlot(diagram: ERDiagram, name: string, slots: ColorSlots | undefined): SlotInks | undefined {
  if (slots === undefined) return undefined;
  const index = entityIndex(diagram, name);
  return index === undefined ? undefined : slotInks(slots, index);
}

export function styleEntityBoxes(canvas: Canvas, spots: Map<string, Spot>, diagram: ERDiagram, cs: CharSet, slots?: ColorSlots): void {
  for (const [name, spot] of spots) {
    const entity = diagram.entities.get(name);
    if (entity === undefined) continue;
    // The box takes the slot's stroke alone here, its tint is banded row by row in `bandEntityBoxes`.
    const strokes = slots === undefined ? undefined : { border: slots.border, fill: undefined };
    const props = slotted(strokes, entityIndex(diagram, name), boxProps(diagram, entity));
    if (props === undefined) continue;
    styleBox(canvas, spot, props, boxClassProps(diagram, entity), cs, wordKey);
  }
}

// The borders moved onto the cell edges as a class box's are, the attribute rule standing inside the walls as a
// compartment rule does. A dashed outline has no eighth of its own to move to and keeps the box alphabet.
export function padEntityBoxes(canvas: Canvas, spots: Map<string, Spot>, diagram: ERDiagram): void {
  const boxes: PaddedBox[] = [];
  for (const [name, spot] of spots) {
    const entity = diagram.entities.get(name);
    if (entity === undefined) continue;
    const rule = ruleRow(entity);
    const rules = rule === undefined ? [] : [spot.y + rule];
    boxes.push({ ...spot, rules, dashed: boxProps(diagram, entity)?.has(PROP_STROKE_DASHARRAY) === true });
  }
  padBoxes(canvas, boxes);
}

// borderless, on a theme that lays their grounds: every entity and the outermost groups as slabs of their ground.
export function slabEntityBorders(drawn: { canvas: Canvas; spots: Map<string, Spot>; frames: Map<string, Spot> }, diagram: ERDiagram, cs: CharSet): void {
  const boxes = [...drawn.spots].flatMap(([name, spot]) => {
    const entity = diagram.entities.get(name);
    return entity === undefined ? [] : [{ ...spot, key: NODE, props: boxProps(diagram, entity) }];
  });
  slabBorders(drawn.canvas, cs, boxes, [...drawn.frames.values()]);
}

// The GROUND, laid last so the band ends each key where the painter reads it. mermaid fills the whole `erBox` with
// the theme's `mainBkg` and lays `rowOdd` and `rowEven` over the attribute rows by turns, wall to wall; a `fill`
// written on the entity bands the name row and every other attribute row, inside the walls.
// A colour slot's tint grounds every row wall to wall, as mermaid's `[data-color-id]` rule fills every rect of the box.
// Under `borders: padless` the side columns keep the page, as a class box's do.
export function bandEntityBoxes(canvas: Canvas, spots: Map<string, Spot>, diagram: ERDiagram, slots: ColorSlots | undefined, padless: boolean): void {
  for (const [name, spot] of spots) {
    const entity = diagram.entities.get(name);
    if (entity === undefined) continue;
    const props = boxProps(diagram, entity);
    const fill = fillHex(props);
    const tint = entitySlot(diagram, name, slots)?.fill;
    const bottom = spot.y + spot.h - 1;
    const right = spot.x + spot.w - 1;
    const names = nameRows(entity).length;
    const firstRow = spot.y + 2 + names;
    const owners = attributeOwners(entity);
    const attributeAt = (r: number): number | undefined => (r >= firstRow ? owners.at(r - firstRow) : undefined);
    // A padless rule's free part lies over the row it closes, so it takes that row's ground.
    const seenOf = (r: number): number => (padless && spot.h > 2 ? (r === spot.y ? r + 1 : r === bottom ? r - 1 : r) : r);
    if (fill === undefined) {
      const rowBand = (r: number): string => {
        const at = attributeAt(seenOf(r));
        return tint ?? (at === undefined ? NODE : at % 2 === 0 ? ROW_ODD : ROW_EVEN);
      };
      layBoxBand(canvas, spot.y, bottom, spot.x, right, rowBand, padless);
      continue;
    }
    for (let r = spot.y; r <= bottom; r++) {
      const seen = seenOf(r);
      const at = attributeAt(seen);
      // A wall jogged out to meet a relation lays its free part inside the box.
      const jogLeft = padless && joggedOut(canvas.get(r, spot.x), true);
      const jogRight = padless && joggedOut(canvas.get(r, right), false);
      const header = entity.attributes.length > 0 ? seen > spot.y && seen <= spot.y + names : seen > spot.y && seen < bottom;
      if (!header && (at === undefined || at % 2 === 0)) continue;
      layBand(canvas, r, r, jogLeft ? spot.x : spot.x + 1, jogRight ? right : right - 1, fill);
    }
  }
}

function groupProps(diagram: ERDiagram, id: string): ReadonlyMap<string, string> | undefined {
  const group = groupOf(diagram.groups, id);
  if (group === undefined) return undefined;
  const merged = new Map<string, string>();
  // mermaid's `addSubGraph` starts a group with no class at all: `classDef default` is an entity's alone.
  for (const name of group.cssClasses) {
    for (const [prop, value] of diagram.classDefs.get(name) ?? []) merged.set(prop, value);
  }
  for (const [prop, value] of group.styles) merged.set(prop, value);
  return merged.size === 0 ? undefined : merged;
}

// A frame wears what mermaid's `setClass` and `addCssStyles` hang on a subgraph: its dashes and weight first
// (`reshapeFrame`), its inks and its `fill` once the cluster's ground is down (`inkFrame`, `fillFrames`).
export function shapeGroupFrames(canvas: Canvas, frames: Map<string, Spot>, diagram: ERDiagram, cs: CharSet): void {
  for (const [id, spot] of frames) {
    const props = groupProps(diagram, id);
    if (props !== undefined) reshapeFrame(canvas, spot, props, cs);
  }
}

export function dressGroupFrames(canvas: Canvas, frames: Map<string, Spot>, diagram: ERDiagram): void {
  for (const [id, spot] of frames) {
    const props = groupProps(diagram, id);
    if (props !== undefined) inkFrame(canvas, spot, props, spot.y + 1);
  }
  fillFrames(canvas, [...frames].map(([id, box]) => ({ box, fill: groupProps(diagram, id) })));
}

export function pinBuriedEnds(
  diagram: ERDiagram,
  pinned: Map<number, PinnedEnds>,
  layerOf: Map<string, number>,
  sizes: Map<string, [number, number]>,
  offsets: EndOffsets,
  isLR: boolean
): void {
  for (const [index, pin] of pinned) {
    const rel = diagram.relationships[index];
    const a = layerOf.get(rel.entity1);
    const b = layerOf.get(rel.entity2);
    if (a === undefined || b === undefined) continue;
    const horizontal = isLR ? a !== b : a === b;
    const towards = (spot: Spot, name: string): number => {
      const [w, h] = must(sizes.get(name));
      return horizontal
        ? spot.y + Math.floor(spot.h / 2) - sideRow(0, h)
        : spot.x + Math.floor(spot.w / 2) - Math.floor(w / 2);
    };
    const exit = pin.one === undefined ? undefined : towards(pin.one.spot, rel.entity1);
    const arrival = pin.two === undefined ? undefined : towards(pin.two.spot, rel.entity2);
    if (exit !== undefined) offsets.exit.set(index, exit);
    if (arrival !== undefined) offsets.arrival.set(index, arrival);
    if (exit !== undefined && arrival === undefined) offsets.arrival.set(index, exit);
    if (arrival !== undefined && exit === undefined) offsets.exit.set(index, arrival);
  }
}
