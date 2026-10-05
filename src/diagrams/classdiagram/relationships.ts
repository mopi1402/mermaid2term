import { drawPolyline, drawRoutedLine, type RowCol } from "../../canvas/elbow.js";
import { type CrossingCut } from "../../canvas/crossings.js";
import { DASHED, type Detour, type NestPlan, type Relationship, type Layout } from "./model.js";
import { centredOnSpan, displayWidth } from "../../text/width.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { lineStrokes } from "../../canvas/strokes.js";
import { must } from "../../must.js";
import { SPACE } from "../../text/chars.js";
import {
  ARROW,
  EDGE,
  EDGE_LABEL,
  EDGE_CHIP,
} from "../../canvas/keys.js";
import { drawBoxStart } from "../../graph/render/glyphs.js";
import { detourPath, relationshipGeometry } from "./geometry.js";
import { markerChar, type Heading } from "./members.js";
import { SELF_ARM, loopRows, loopSideOf } from "./metrics.js";
import { chipTop, putLabelRows, stampChip, stampedWidth } from "../../canvas/chip.js";
import { insideABox, labelSeatClear, writeChip } from "../@common/box-diagram.js";
import { labelLines, widestLabelLine } from "../../text/labels.js";
import { rectFree } from "../../canvas/cells.js";
import { nestArm, nestReach, nestRoom } from "./nests.js";
import { cornersOf } from "../../canvas/corners.js";

// A relation from a class to itself: mermaid loops it out of one side and back, and a straight run between the two
// ends is the box's own middle row, which is why this used to be drawn THROUGH the class. The loop rides the two
// columns beside the wall, leaving on the row under the name and returning three rows down.
export function selfLoopRoom(rel: Relationship, layout: Layout): number {
  const at = layout.positions.get(rel.source);
  if (at === undefined) return 0;
  const [sw] = must(layout.sizes.get(rel.source));
  const plan = layout.nests?.get(rel.source);
  const label = rel.label === "" ? 0 : widestLabelLine(rel.label) + 1;
  const room = plan === undefined ? SELF_ARM + label : nestRoom(plan.loops)[0];
  return at[0] + sw + (loopSideOf(layout, rel.source) > 0 ? room : 0);
}

// The row under everything a nest laid upward takes below its box.
export function selfLoopFloor(rel: Relationship, layout: Layout): number {
  const at = layout.positions.get(rel.source);
  const plan = layout.nests?.get(rel.source);
  if (at === undefined || plan === undefined || !plan.floor) return 0;
  return at[1] + must(layout.sizes.get(rel.source))[1] + nestRoom(plan.loops)[1];
}

function drawSelfRelationship(canvas: Canvas, rel: Relationship, layout: Layout, cs: CharSet, ends: Ends): void {
  const at = layout.positions.get(rel.source);
  if (at === undefined) return;
  const plan = layout.nests?.get(rel.source);
  if (plan !== undefined) {
    drawNestedLoop(canvas, rel, plan, layout, cs, ends);
    return;
  }
  const [sx, sy] = at;
  const [sw, sh] = must(layout.sizes.get(rel.source));
  const side = loopSideOf(layout, rel.source);
  const out = side > 0 ? sx + sw : sx - 1;
  const turn = out + side * (SELF_ARM - 1);
  const [top, bottom] = loopRows(sy, sh);

  const [hChar, vChar] = lineStrokes(cs, rel.lineStyle === DASHED);
  for (let c = out; c !== turn; c += side) {
    canvas.put(top, c, hChar, false, EDGE);
    canvas.put(bottom, c, hChar, false, EDGE);
  }
  canvas.put(top, turn, side > 0 ? cs.topRight : cs.topLeft, false, EDGE);
  canvas.put(bottom, turn, side > 0 ? cs.bottomRight : cs.bottomLeft, false, EDGE);
  canvas.putColumn(turn, top + 1, bottom, vChar, false, EDGE);

  const heading: Heading = side > 0 ? "left" : "right";
  const walled = ends.walled(rel.source);
  attach(canvas, cs, top, out, heading, markerChar(cs, rel.sourceMarker, heading), walled, ends.padless);
  attach(canvas, cs, bottom, out, heading, markerChar(cs, rel.targetMarker, heading), walled, ends.padless);
  const from = (text: string, col: number): number => (side > 0 ? col : col - displayWidth(text) + 1);
  if (rel.sourceCard !== "") canvas.putText(top - 1, from(rel.sourceCard, out), rel.sourceCard, EDGE_LABEL);
  if (rel.targetCard !== "") canvas.putText(bottom + 1, from(rel.targetCard, out), rel.targetCard, EDGE_LABEL);
  const labelAt = side > 0 ? turn + 2 : turn - 1 - widestLabelLine(rel.label);
  if (rel.label !== "") putLabelRows(canvas, chipTop(Math.floor((top + bottom) / 2), rel.label), labelAt, rel.label, EDGE_LABEL, rel.labelSegments);
}

// One loop of a nest: up from its lid exit to its own ride row, past the loops inside it and their labels, and back
// to its own wall row, its marks at both ends and its label beside its turn.
function drawNestedLoop(canvas: Canvas, rel: Relationship, plan: NestPlan, layout: Layout, cs: CharSet, ends: Ends): void {
  const rank = plan.loops.indexOf(rel);
  const [x, y] = must(layout.positions.get(rel.source));
  const [w, h] = must(layout.sizes.get(rel.source));
  const side = loopSideOf(layout, rel.source);
  const away = plan.floor ? 1 : -1;
  const corner = side > 0 ? x + w - 1 : x;
  const out = corner + side;
  const exit = corner - side * plan.exits[rank];
  const beyond = (plan.floor ? y + h - 1 : y) + away;
  const ride = beyond + away * (1 + rank);
  const turn = out + side * (nestArm(plan.loops) + nestReach(plan.loops)[rank]);
  const back = y + plan.returns[rank];

  const [hChar, vChar] = lineStrokes(cs, rel.lineStyle === DASHED);
  const leftward = side < 0;
  canvas.putColumn(exit, Math.min(beyond, ride) + (plan.floor ? 0 : 1), Math.max(beyond, ride) + (plan.floor ? 0 : 1), vChar, false, EDGE);
  canvas.putColumn(turn, Math.min(ride, back) + 1, Math.max(ride, back), vChar, false, EDGE);
  canvas.putRow(ride, Math.min(exit, turn) + 1, Math.max(exit, turn), hChar, false, EDGE);
  canvas.putRow(back, Math.min(out, turn - side), Math.max(out, turn - side) + 1, hChar, false, EDGE);
  const [topLeft, topRight, bottomLeft, bottomRight] = cornersOf(cs, ends.rounded);
  const [near, far] = plan.floor ? [bottomLeft, bottomRight] : [topLeft, topRight];
  canvas.put(ride, exit, leftward ? far : near, false, EDGE);
  canvas.put(ride, turn, leftward ? near : far, false, EDGE);
  const [inner, outer] = plan.floor ? [topLeft, topRight] : [bottomLeft, bottomRight];
  canvas.put(back, turn, leftward ? inner : outer, false, EDGE);

  const walled = ends.walled(rel.source);
  const lid: Heading = plan.floor ? "up" : "down";
  const wall: Heading = side > 0 ? "left" : "right";
  attach(canvas, cs, beyond, exit, lid, markerChar(cs, rel.sourceMarker, lid), walled, false);
  attach(canvas, cs, back, out, wall, markerChar(cs, rel.targetMarker, wall), walled, ends.padless);
  const from = (text: string, col: number): number => (side > 0 ? col : col - displayWidth(text) + 1);
  if (rel.sourceCard !== "") canvas.putText(beyond, from(rel.sourceCard, exit + side), rel.sourceCard, EDGE_LABEL);
  if (rel.targetCard !== "") canvas.putText(back - away, from(rel.targetCard, out), rel.targetCard, EDGE_LABEL);
  if (rel.label === "") return;
  const labelAt = side > 0 ? turn + 2 : turn - 1 - widestLabelLine(rel.label);
  putLabelRows(canvas, plan.floor ? ride - labelLines(rel.label) : ride + 1, labelAt, rel.label, EDGE_LABEL, rel.labelSegments);
}

const INTO: Record<Heading, readonly [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

// How the two ends of a relation meet the boxes they join: a LOLLIPOP is a ring on a stick and has no wall to meet,
// and padless is where a wall inks one eighth of its cell, too far in for anything stopping outside to touch it.
export interface Ends {
  readonly padless: boolean;
  readonly rounded: boolean;
  readonly walled: (name: string) => boolean;
  readonly cut: CrossingCut | undefined;
}

const OPEN_ENDS: Ends = { padless: false, rounded: true, walled: () => true, cut: undefined };

// The end of a relation stands on the cell OUTSIDE the box, `heading` naming the way the box lies from there. The
// outline has to accuse it, as a flowchart's box does: an end carrying no marker cuts a tee into the wall it lands
// on, the frame being drawn over this and merging with it. Under padless a MARK stands on the wall's own cell
// instead, the fitter moving the wall one cell inside it (`faceTheRuns`), and the run keeps the cell it had.
function attach(canvas: Canvas, cs: CharSet, row: number, col: number, heading: Heading, marker: string, walled: boolean, onTheWall: boolean): void {
  const [dr, dc] = INTO[heading];
  if (marker === "") {
    if (walled) drawBoxStart(canvas, [col + dc, row + dr], [col, row], cs, false);
    return;
  }
  const stuck = walled && onTheWall;
  const at: readonly [number, number] = stuck ? [row + dr, col + dc] : [row, col];
  canvas.put(at[0], at[1], marker, false, ARROW);
  // The frame is drawn after the runs and would take the cell back, a mark carrying no arm for it to merge with.
  if (stuck) canvas.protect(at[0], at[1]);
}

export function drawRelationship(
  canvas: Canvas,
  rel: Relationship,
  layout: Layout,
  cs: CharSet,
  colOffset: number,
  isLR: boolean,
  exitRun: number,
  endOffset = 0,
  bendRank: number | undefined = undefined,
  ends: Ends = OPEN_ENDS
): void {
  if (rel.source === rel.target) {
    drawSelfRelationship(canvas, rel, layout, cs, ends);
    return;
  }
  const detour = layout.detours?.get(rel);
  if (detour !== undefined) {
    drawDetour(canvas, rel, layout, cs, isLR, detour, ends);
    return;
  }
  const geometry = relationshipGeometry(rel, layout, colOffset, isLR, endOffset, bendRank);
  if (geometry === undefined) return;
  const { startCol, startRow, endCol, endRow, horizontal, forward } = geometry;

  const sourceHeading: Heading = horizontal ? (forward ? "left" : "right") : forward ? "up" : "down";
  const targetHeading: Heading = horizontal ? (forward ? "right" : "left") : forward ? "down" : "up";

  const [hChar, vChar] = lineStrokes(cs, rel.lineStyle === DASHED);
  drawRoutedLine(canvas, startRow, startCol, endRow, endCol, hChar, vChar, cs, EDGE, {
    merge: false,
    acrossOut: horizontal ? exitRun : 0,
    bendRow: geometry.bendRow,
    rounded: ends.rounded,
    cut: ends.cut,
  });

  const atSource = markerChar(cs, rel.sourceMarker, sourceHeading);
  const atTarget = markerChar(cs, rel.targetMarker, targetHeading);
  const onTheWall = horizontal && ends.padless;
  attach(canvas, cs, startRow, startCol, sourceHeading, atSource, ends.walled(rel.source), onTheWall);
  attach(canvas, cs, endRow, endCol, targetHeading, atTarget, ends.walled(rel.target), onTheWall);

  const beside = (row: number, col: number, card: string, outward: number): void => {
    if (!horizontal) {
      canvas.putText(row, outward < 0 ? col - displayWidth(card) : col + 1, card, EDGE_LABEL);
      return;
    }
    const width = displayWidth(card);
    const runLeft = Math.min(startCol, endCol);
    const runRight = Math.max(startCol, endCol);
    const wanted = outward > 0 ? col : col - width + 1;
    const left = Math.min(Math.max(wanted, runLeft), Math.max(runLeft, runRight + 1 - width));
    const clear = (at: number): boolean => {
      return !insideABox(layout, at, left, width) && rectFree(canvas, at, left, 1, width);
    };
    canvas.putText(clear(row - 1) ? row - 1 : clear(row + 1) ? row + 1 : row, left, card, EDGE_LABEL);
  };
  if (rel.sourceCard !== "") beside(startRow, startCol, rel.sourceCard, horizontal ? (forward ? 1 : -1) : colOffset < 0 ? -1 : 1);
  if (rel.targetCard !== "") beside(endRow, endCol, rel.targetCard, horizontal ? (forward ? -1 : 1) : 1);
}

function drawDetour(canvas: Canvas, rel: Relationship, layout: Layout, cs: CharSet, isLR: boolean, detour: Detour, ends: Ends): void {
  const { points, headings, facing } = detourPath(rel, detour, layout, isLR);
  const [hChar, vChar] = lineStrokes(cs, rel.lineStyle === DASHED);
  drawPolyline(canvas, points, headings, { hChar, vChar, cs, style: EDGE, merge: false, rounded: ends.rounded, heavy: false, trail: undefined, cut: ends.cut });
  const [first, , , last] = points;
  attach(canvas, cs, first[0], first[1], facing, markerChar(cs, rel.sourceMarker, facing), ends.walled(rel.source), isLR && ends.padless);
  attach(canvas, cs, last[0], last[1], facing, markerChar(cs, rel.targetMarker, facing), ends.walled(rel.target), isLR && ends.padless);
  const card = ([row, col]: RowCol, text: string): void => {
    if (text === "") return;
    if (isLR) canvas.putText(row - 1, detour.side > 0 ? col : col - displayWidth(text) + 1, text, EDGE_LABEL);
    else canvas.putText(row, col + 1, text, EDGE_LABEL);
  };
  card(first, rel.sourceCard);
  card(last, rel.targetCard);
}

// A detour's label: on its ride across the page, beside it down the page.
function drawDetourLabel(canvas: Canvas, rel: Relationship, layout: Layout, isLR: boolean, detour: Detour): void {
  const { points } = detourPath(rel, detour, layout, isLR);
  const [, [r1, c1], [r2, c2]] = points;
  if (isLR) {
    putLabelRows(canvas, chipTop(Math.floor((r1 + r2) / 2), rel.label), detour.ride + (detour.side > 0 ? 2 : -1 - widestLabelLine(rel.label)), rel.label, EDGE_LABEL, rel.labelSegments);
    return;
  }
  writeChip(canvas, chipTop(r1, rel.label), centredOnSpan(Math.floor((c1 + c2) / 2), stampedWidth(rel.label)), rel);
}

export function drawRelationshipLabel(
  canvas: Canvas,
  rel: Relationship,
  layout: Layout,
  cs: CharSet,
  colOffset: number,
  isLR: boolean,
  exitRun: number,
  endOffset = 0,
  bendRank: number | undefined = undefined
): void {
  if (rel.label === "" || rel.source === rel.target) return;
  const detour = layout.detours?.get(rel);
  if (detour !== undefined) {
    drawDetourLabel(canvas, rel, layout, isLR, detour);
    return;
  }
  const geometry = relationshipGeometry(rel, layout, colOffset, isLR, endOffset, bendRank);
  if (geometry === undefined) return;

  const labelWidth = widestLabelLine(rel.label);
  const height = labelLines(rel.label);
  const midRow = Math.floor((geometry.startRow + geometry.endRow) / 2);
  const midCol = Math.floor((geometry.startCol + geometry.endCol) / 2);

  const blank = (row: number, c: number): boolean => canvas.get(row, c) === SPACE && canvas.getStyle(row, c) !== EDGE_CHIP;
  const free = (row: number, from: number, width = labelWidth, skip = -1): boolean =>
    labelSeatClear(layout, canvas, row, from, width, height, blank, skip);
  // A chip on a run stands on the run's own cells, the rows it adds above and below it blank.
  const chipFree = (row: number, from: number): boolean => height === 1 || free(chipTop(row, rel.label), from, stampedWidth(rel.label), row);

  if (geometry.horizontal) {
    const runRow = geometry.startRow === geometry.endRow ? geometry.startRow : midRow;
    const chipLeft = centredOnSpan(midCol, stampedWidth(rel.label));
    const runLeft = Math.min(geometry.startCol, geometry.endCol);
    const runRight = Math.max(geometry.startCol, geometry.endCol);
    if (geometry.startRow === geometry.endRow && chipLeft > runLeft && chipLeft + stampedWidth(rel.label) - 1 < runRight && chipFree(runRow, chipLeft)) {
      writeChip(canvas, chipTop(runRow, rel.label), chipLeft, rel);
      return;
    }
    if (geometry.startRow !== geometry.endRow) {
      const toward = geometry.endCol > geometry.startCol ? 1 : -1;
      const bendCol = geometry.startCol + toward * exitRun;
      const farLeft = Math.min(bendCol, geometry.endCol);
      const farRight = Math.max(bendCol, geometry.endCol);
      const farChip = centredOnSpan(Math.floor((farLeft + farRight) / 2), stampedWidth(rel.label));
      if (farChip > farLeft && farChip + stampedWidth(rel.label) - 1 < farRight && chipFree(geometry.endRow, farChip)) {
        writeChip(canvas, chipTop(geometry.endRow, rel.label), farChip, rel);
        return;
      }
    }
    const centred = centredOnSpan(midCol, labelWidth);
    const row = free(runRow - height, centred) ? runRow - height : free(runRow + 1, centred) ? runRow + 1 : undefined;
    if (row !== undefined) putLabelRows(canvas, row, centred, rel.label, EDGE_LABEL, rel.labelSegments);
    else putLabelRows(canvas, chipTop(midRow, rel.label), midCol + 2, rel.label, EDGE_LABEL, rel.labelSegments);
    return;
  }

  const lower = Math.max(geometry.startRow, geometry.endRow);
  const upper = Math.min(geometry.startRow, geometry.endRow);
  const topMarked = (geometry.forward ? rel.sourceMarker : rel.targetMarker) !== undefined;
  const bottomMarked = (geometry.forward ? rel.targetMarker : rel.sourceMarker) !== undefined;
  const shaftMid = Math.floor((upper + (topMarked ? 1 : 0) + lower - (bottomMarked ? 1 : 0)) / 2);
  const bend = geometry.bendRow;
  const labelRow =
    geometry.startCol === geometry.endCol
      ? shaftMid
      : geometry.endRow > bend
        ? Math.min(bend + 1, geometry.endRow)
        : Math.max(bend - 1, geometry.endRow);
  const isShaft = (ch: string): boolean => ch === cs.lineVertical || ch === cs.lineDottedV;
  const shaftAt = (row: number): number | undefined =>
    isShaft(canvas.get(row, geometry.startCol)) ? geometry.startCol : isShaft(canvas.get(row, geometry.endCol)) ? geometry.endCol : undefined;
  const clearFor = (row: number): number | undefined => {
    const top = chipTop(row, rel.label);
    if (top <= upper || top + height - 1 >= lower) return undefined;
    const col = shaftAt(row);
    if (col === undefined) return undefined;
    const left = centredOnSpan(col, stampedWidth(rel.label));
    for (let r = top; r < top + height; r++) {
      if (shaftAt(r) !== col) return undefined;
      for (let c = left; c < left + stampedWidth(rel.label); c++) if (c !== col && !blank(r, c)) return undefined;
    }
    return left;
  };
  for (let away = 0; shaftMid - away > upper || shaftMid + away < lower; away++) {
    for (const row of away === 0 ? [shaftMid] : [shaftMid - away, shaftMid + away]) {
      const left = clearFor(row);
      if (left !== undefined) {
        writeChip(canvas, chipTop(row, rel.label), left, rel);
        return;
      }
    }
  }
  const shaft = shaftAt(labelRow);
  if (shaft !== undefined) {
    // Past a bend the chip hangs from the row after it, toward the box, and never back over the turn.
    const past = geometry.startCol === geometry.endCol ? chipTop(labelRow, rel.label) : geometry.endRow > bend ? labelRow : labelRow - height + 1;
    stampChip(canvas, past, centredOnSpan(shaft, stampedWidth(rel.label)), rel.label, EDGE_CHIP, rel.labelSegments);
    return;
  }
  const rightCol = geometry.endCol + 2;
  const leftCol = geometry.endCol - 1 - labelWidth;
  const top = chipTop(labelRow, rel.label);
  const col = free(top, rightCol) ? rightCol : free(top, leftCol) ? leftCol : rightCol;
  putLabelRows(canvas, top, col, rel.label, EDGE_LABEL, rel.labelSegments);
}
