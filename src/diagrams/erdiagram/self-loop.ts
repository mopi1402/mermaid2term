import { DASHED, type ERDiagram, type Relationship, type Layout } from "./model.js";
import { Canvas } from "../../canvas/canvas.js";
import { chipTop, stampedWidth } from "../../canvas/chip.js";
import { type CharSet } from "../../canvas/model.js";
import { type Toward } from "../../canvas/corners.js";
import { drawPolyline } from "../../canvas/elbow.js";
import { lineStrokes } from "../../canvas/strokes.js";
import { must } from "../../must.js";
import {
  EDGE,
  NODE,
} from "../../canvas/keys.js";
import { writeChip } from "../@common/box-diagram.js";
import { drawCardMarker, weldEnd } from "./entity-box.js";
import { sideRow } from "./metrics.js";
import { clearOf, entryAt, loopFaces, partners, seatsOn } from "./loop-faces.js";
import { nestShape, nestsOf } from "./loop-nest.js";

// The loops written on the same entity as a self relation, itself among them: one alone, or the nest it belongs to.
const nestHolding = (diagram: ERDiagram, rel: Relationship, index: number): number[] => nestsOf(diagram).get(rel.entity1) ?? [index];

// How far the drawing must move right and down for a loop that leaves left or comes back from above to stay on it.
export function loopRoom(diagram: ERDiagram, layout: Layout): [number, number] {
  let right = 0;
  let down = 0;
  diagram.relationships.forEach((rel, index) => {
    if (rel.entity1 !== rel.entity2) return;
    const at = layout.positions.get(rel.entity1);
    if (at === undefined) return;
    const nest = nestHolding(diagram, rel, index);
    const faces = loopFaces(rel, nest[0], layout, diagram, nest.length);
    const [w, h] = layout.sizes.get(rel.entity1) ?? [0, 0];
    const shape = nestShape(diagram, nest, faces, w, h);
    if (faces.side < 0) right = Math.max(right, 1 - at[0] - Math.min(...shape.outers));
    if (faces.down < 0) down = Math.max(down, 1 - shape.last - at[1]);
  });
  return [right, down];
}

// Where a nest round its box ends on the canvas: its last column past the right flank and its last row.
export function loopReach(diagram: ERDiagram, layout: Layout, rel: Relationship, index: number): [number, number] {
  const [x, y] = must(layout.positions.get(rel.entity1));
  const [w, h] = must(layout.sizes.get(rel.entity1));
  const nest = nestHolding(diagram, rel, index);
  const faces = loopFaces(rel, nest[0], layout, diagram, nest.length);
  const shape = nestShape(diagram, nest, faces, w, h);
  return [x + Math.max(w, ...shape.outers) + 2, faces.down > 0 ? y + shape.last + 2 : y + h];
}

export function drawSelfLoop(
  canvas: Canvas,
  rel: Relationship,
  index: number,
  layout: Layout,
  diagram: ERDiagram,
  cs: CharSet,
  rounded: boolean,
  tint: string = NODE
): void {
  const at = layout.positions.get(rel.entity1);
  const size = layout.sizes.get(rel.entity1);
  if (at === undefined || size === undefined) return;
  const [x, y] = at;
  const [w, h] = size;
  const nest = nestHolding(diagram, rel, index);
  const k = nest.indexOf(index);
  const faces = loopFaces(rel, nest[0], layout, diagram, nest.length);
  const v = faces.down;
  const rowOf = (j: number): number => sideRow(y, h) + (layout.offsets.exit.get(j) ?? 0);
  const exitRow = rowOf(index);
  const markerRow = v > 0 ? y + h : y - 1;
  const borderRow = v > 0 ? y + h - 1 : y;
  const chip = rel.label === "" ? 0 : stampedWidth(rel.label);

  // Only the ends on the face the loop comes back through stand where it lands; the others are on other faces.
  const seats = seatsOn(partners(rel, index, layout, diagram), v, layout, x, w);
  const shapeOn = (side: 1 | -1): ReturnType<typeof nestShape> => nestShape(diagram, nest, { side, down: v }, w, h);
  const fits = (side: 1 | -1): boolean => {
    const shape = shapeOn(side);
    const outer = x + must(shape.outers.at(-1));
    if (outer < 1 || !clearOf(seats, x + must(shape.entries.at(-1)), side)) return false;
    const cLo = Math.min(outer, side > 0 ? x + w : x - 1);
    const cHi = Math.max(outer, side > 0 ? x + w : x - 1);
    const rows = [...nest.map(rowOf), y + shape.rows[0], y + (nest.length > 1 ? shape.last : shape.rows[0])];
    const rLo = Math.min(...rows);
    const rHi = Math.max(...rows);
    for (const [name, [bx, by]] of layout.positions) {
      if (name === rel.entity1) continue;
      const [bw, bh] = must(layout.sizes.get(name));
      if (by <= rHi && by + bh - 1 >= rLo && bx <= cHi && bx + bw - 1 >= cLo) return false;
    }
    return true;
  };
  const mode = fits(faces.side) ? "free" : fits(faces.side > 0 ? -1 : 1) ? "turned" : nest.length > 1 ? "free" : "tight";
  const side = mode === "turned" ? (faces.side > 0 ? -1 : 1) : mode === "tight" ? 1 : faces.side;
  const shape = shapeOn(side);
  const loopRow = y + shape.rows[k];
  const entryCol = mode === "tight" ? entryAt(x, w, side) : x + shape.entries[k];
  const outer = mode === "tight" ? x + w + 2 : x + shape.outers[k];

  const [hChar, vChar] = lineStrokes(cs, rel.lineStyle === DASHED);
  const markerCol = side > 0 ? x + w : x - 1;
  const [out, back]: [Toward, Toward] = side > 0 ? ["right", "left"] : ["left", "right"];
  const [along, home]: [Toward, Toward] = v > 0 ? ["down", "up"] : ["up", "down"];
  const stroke = { hChar, vChar, cs, style: EDGE, merge: false, rounded, heavy: false, trail: home };
  const run: Array<[number, number]> = [[exitRow, markerCol + side], [exitRow, outer], [loopRow, outer], [loopRow, entryCol]];
  // A loop further out in a nest climbs back past the rows the ones inside it ride.
  if (loopRow !== markerRow + v) drawPolyline(canvas, [...run, [markerRow + v, entryCol]], [out, along, back, home], { ...stroke, trail: undefined });
  else drawPolyline(canvas, run, [out, along, back], stroke);
  drawCardMarker(canvas, rel.card1, exitRow, markerCol, 0, -side, cs);
  drawCardMarker(canvas, rel.card2, markerRow, entryCol, -v, 0, cs);

  const sideTee = side > 0 ? cs.teeRight : cs.teeLeft;
  const borderCol = side > 0 ? x + w - 1 : x;
  weldEnd(canvas, cs, exitRow, borderCol, sideTee, rel.card1, tint);
  weldEnd(canvas, cs, borderRow, entryCol, v > 0 ? cs.teeDown : cs.teeUp, rel.card2, tint);

  if (chip > 0) {
    if (mode === "tight") {
      writeChip(canvas, chipTop(loopRow, rel.label), Math.max(1, entryCol - 1 - chip), rel);
      return;
    }
    const lo = Math.min(entryCol, outer) + 2;
    const hi = Math.max(entryCol, outer) - 2;
    const start = Math.min(Math.max(Math.floor((lo + hi + 1) / 2) - Math.floor(chip / 2), lo), hi - chip + 1);
    writeChip(canvas, chipTop(loopRow, rel.label), start, rel);
  }
}
