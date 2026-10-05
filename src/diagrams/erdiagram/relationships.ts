import { SPACE } from "../../text/chars.js";
import { drawPolyline, drawRoutedLine } from "../../canvas/elbow.js";
import { type CrossingCut } from "../../canvas/crossings.js";
import { DASHED, type Relationship, type EndOffsets, type Layout, type PinnedEnds } from "./model.js";
import { labelLines, widestLabelLine } from "../../text/labels.js";
import { centredOffset } from "../../text/width.js";
import { CHIP_INSET, chipTop, stampedWidth } from "../../canvas/chip.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { cornerOf, type Toward } from "../../canvas/corners.js";
import { lineStrokes } from "../../canvas/strokes.js";
import { must } from "../../must.js";
import {
  EDGE,
} from "../../canvas/keys.js";
import { NO_PIERCE } from "./chips.js";
import { labelSeatClear, writeChip } from "../@common/box-diagram.js";
import { drawCardMarker } from "./entity-box.js";
import { LABEL_AIR, MARKER_ALONG } from "./metrics.js";
import { bandRows, relationshipGeometry, type RelGeometry, type RoutingPlan } from "./geometry.js";

function drawRelationshipLine(canvas: Canvas, g: RelGeometry, hChar: string, vChar: string, cs: CharSet, rounded: boolean, cut: CrossingCut | undefined): void {
  const { startCol: c1, startRow: r1, endCol: c2, endRow: r2 } = g;
  const turn = (row: number, col: number, inward: Toward, outward: Toward): void =>
    canvas.put(row, col, must(cornerOf(inward, outward, cs, rounded)), false, EDGE);

  const corridor = g.corridor;
  if (corridor !== undefined) {
    const stroke = { hChar, vChar, cs, style: EDGE, merge: false, rounded, heavy: false, trail: undefined, cut };
    if (g.horizontal) {
      const across = c2 > c1 ? "right" : "left";
      drawPolyline(canvas, [[r1, c1], [corridor, c1], [corridor, c2], [r2, c2]], [r1 > corridor ? "up" : "down", across, r2 > corridor ? "down" : "up"], stroke);
      return;
    }
    const along = r2 > r1 ? "down" : "up";
    drawPolyline(canvas, [[r1, c1], [r1, corridor], [r2, corridor], [r2, c2]], [c1 > corridor ? "left" : "right", along, c2 > corridor ? "right" : "left"], stroke);
    return;
  }

  if (!g.horizontal) {
    drawRoutedLine(canvas, r1, c1, r2, c2, hChar, vChar, cs, EDGE, { merge: false, bendRow: g.bend, rounded, cut });
    const toward = c1 === c2 ? [r2, r1] : [g.bend ?? Math.floor((r1 + r2) / 2), g.bend ?? Math.floor((r1 + r2) / 2)];
    if (g.flankOne !== undefined) turn(r1, c1, g.flankOne < 0 ? "left" : "right", toward[0] > r1 ? "down" : "up");
    if (g.flankTwo !== undefined) turn(r2, c2, g.flankTwo < 0 ? "left" : "right", toward[1] > r2 ? "down" : "up");
    return;
  }

  drawRoutedLine(canvas, r1, c1, r2, c2, hChar, vChar, cs, EDGE, { merge: false, bendCol: g.bend ?? Math.floor((c1 + c2) / 2), rounded, cut });
  const toward = r1 === r2 ? [c2, c1] : [g.bend ?? Math.floor((c1 + c2) / 2), g.bend ?? Math.floor((c1 + c2) / 2)];
  if (g.flankOne !== undefined) turn(r1, c1, g.flankOne < 0 ? "up" : "down", toward[0] > c1 ? "right" : "left");
  if (g.flankTwo !== undefined) turn(r2, c2, g.flankTwo < 0 ? "up" : "down", toward[1] > c2 ? "right" : "left");
}

export function drawRelationship(
  canvas: Canvas,
  rel: Relationship,
  index: number,
  layout: Layout,
  plan: RoutingPlan,
  offsets: EndOffsets,
  cs: CharSet,
  rounded: boolean,
  isLR: boolean,
  through: { one: boolean; two: boolean } = NO_PIERCE,
  pin: PinnedEnds | undefined = undefined,
  cut: CrossingCut | undefined = undefined
): void {
  const g = relationshipGeometry(rel, index, layout, plan, offsets, isLR, pin);
  if (g === undefined) return;

  const [hChar, vChar] = lineStrokes(cs, rel.lineStyle === DASHED);
  drawRelationshipLine(canvas, g, hChar, vChar, cs, rounded, cut);

  let intoSource: [number, number];
  let intoTarget: [number, number];
  if (g.corridor !== undefined) {
    intoSource = g.horizontal ? [1, 0] : [0, 1];
    intoTarget = intoSource;
  } else if (!g.horizontal) {
    intoSource = g.forward ? [-1, 0] : [1, 0];
    intoTarget = g.forward ? [1, 0] : [-1, 0];
  } else {
    intoSource = g.forward ? [0, -1] : [0, 1];
    intoTarget = g.forward ? [0, 1] : [0, -1];
  }
  if (!through.one) drawCardMarker(canvas, rel.card1, g.startRow, g.startCol, intoSource[0], intoSource[1], cs);
  if (!through.two) drawCardMarker(canvas, rel.card2, g.endRow, g.endCol, intoTarget[0], intoTarget[1], cs);
}

export function drawRelationshipLabel(
  canvas: Canvas,
  rel: Relationship,
  index: number,
  layout: Layout,
  plan: RoutingPlan,
  offsets: EndOffsets,
  isLR: boolean,
  pin: PinnedEnds | undefined = undefined
): void {
  if (rel.label === "") return;
  const g = relationshipGeometry(rel, index, layout, plan, offsets, isLR, pin);
  if (g === undefined) return;

  const labelWidth = widestLabelLine(rel.label);
  const height = labelLines(rel.label);
  const free = (top: number, from: number, skip = -1): boolean =>
    labelSeatClear(layout, canvas, top, from, labelWidth, height, (r, c) => c === skip || canvas.get(r, c) === SPACE);
  const besideVertical = (row: number, col: number): void => {
    const rightCol = col + 3;
    const leftCol = col - 2 - labelWidth;
    const top = chipTop(row, rel.label);
    const at = free(top, rightCol) ? rightCol : free(top, leftCol) ? leftCol : rightCol;
    writeChip(canvas, top, at - CHIP_INSET, rel);
  };

  const chipWidth = stampedWidth(rel.label);
  const inside = (col: number): number => Math.max(0, Math.min(col, canvas.width - chipWidth));
  // Laid across its line where that is clear, else hung beside it: never on a box a short run hugs.
  const onVertical = (col: number, top: number, bottom: number): void => {
    const row = Math.floor((top + bottom) / 2);
    const at = inside(col - Math.floor((chipWidth - 1) / 2));
    const first = chipTop(row, rel.label);
    const within = height === 1 || (first > Math.min(top, bottom) && first + height - 1 < Math.max(top, bottom));
    const open = within && free(first, at + CHIP_INSET, col);
    if (open) writeChip(canvas, first, at, rel);
    else besideVertical(row, col);
  };
  const onHorizontal = (row: number, from: number, to: number): void => {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const centred = Math.min(Math.max(lo + centredOffset(hi - lo + 1, chipWidth), lo), hi - chipWidth + 1);
    writeChip(canvas, chipTop(row, rel.label), inside(centred), rel);
  };
  const carries = (from: number, to: number): boolean => Math.abs(to - from) + 1 >= chipWidth + 2 + LABEL_AIR;

  if (g.corridor !== undefined) {
    if (g.horizontal) onHorizontal(g.corridor, g.startCol, g.endCol);
    else onVertical(g.corridor, g.startRow, g.endRow);
    return;
  }

  if (!g.horizontal) {
    if (g.flankOne !== undefined || g.flankTwo !== undefined) {
      const bend = g.bend ?? Math.floor((g.startRow + g.endRow) / 2);
      if (carries(g.startCol, g.endCol)) onHorizontal(bend, g.startCol, g.endCol);
      else besideVertical(Math.floor((bend + g.endRow) / 2), g.endCol);
      return;
    }
    const a = must(layout.layerOf.get(rel.entity1));
    const b = must(layout.layerOf.get(rel.entity2));
    const [bandStart, lowerTop] = bandRows(layout, Math.min(a, b));
    const chip = layout.chips?.get(index);
    if (chip !== undefined) {
      writeChip(canvas, chip.top ? bandStart + MARKER_ALONG : lowerTop - MARKER_ALONG - height, inside(chip.at), rel);
      return;
    }
    const col = g.forward ? g.endCol : g.startCol;
    writeChip(canvas, lowerTop - MARKER_ALONG - height, inside(col - Math.floor((chipWidth - 1) / 2)), rel);
    return;
  }

  if (g.startRow === g.endRow) {
    const lo = Math.min(g.startCol, g.endCol) + MARKER_ALONG + 1;
    const hi = Math.max(g.startCol, g.endCol) - MARKER_ALONG - 1;
    const centred = Math.min(Math.max(lo + centredOffset(hi - lo - 1, labelWidth), lo), hi - labelWidth - 1);
    writeChip(canvas, chipTop(g.startRow, rel.label), centred, rel);
    return;
  }
  const bend = g.bend ?? Math.floor((g.startCol + g.endCol) / 2);
  const startArm = Math.abs(bend - g.startCol);
  const endArm = Math.abs(g.endCol - bend);
  if (carries(g.startCol, bend) && startArm >= endArm) onHorizontal(g.startRow, g.startCol, bend);
  else if (carries(bend, g.endCol)) onHorizontal(g.endRow, bend, g.endCol);
  else if (carries(g.startCol, bend)) onHorizontal(g.startRow, g.startCol, bend);
  else if (Math.abs(g.endRow - g.startRow) + 1 >= 3) onVertical(bend, g.startRow, g.endRow);
  else besideVertical(Math.floor((g.startRow + g.endRow) / 2), bend);
}

