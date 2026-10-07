import { clearRect } from "../../canvas/cells.js";
import { type Message, BOTTOM, DOTTED } from "./model.js";
import { displayWidth } from "../../text/width.js";
import { Canvas } from "../../canvas/canvas.js";
import { type BandArms, type CharSet } from "../../canvas/model.js";
import { lineStrokes } from "../../canvas/strokes.js";
import { cornersOf } from "../../canvas/corners.js";
import { bandGlyph, type BandCell } from "./bands.js";
import {
  STYLE_ACTIVE,
  STYLE_SIGNAL as STYLE_ARROW,
  STYLE_SIGNAL_LINE as EDGE,
  STYLE_SIGNAL_LABEL as EDGE_LABEL,
} from "./ink.js";
import { labelLines } from "./metrics.js";
import { widestLine } from "../../text/width.js";

const SELF_LOOP_MIN = 8;

export const selfSpan = (col: number, label: string): [number, number] => {
  const width = widestLine(label);
  const left = selfLabelLeft(col, width);
  return [left, Math.max(col + SELF_LOOP_MIN - 1, left + width - 1)];
};

const selfLabelLeft = (col: number, width: number): number => Math.max(0, col - Math.floor(width / 2));

// How far a self message's label and loop stand left and right of its lifeline, before any clamp to the edge.
export const selfExtent = (label: string): [number, number] => {
  const width = widestLine(label);
  const left = Math.floor(width / 2);
  return [left, Math.max(SELF_LOOP_MIN - 1, width - 1 - left)];
};

const halfHead = (message: Message, headRight: boolean, cs: CharSet): string => {
  const table = message.arrowType === "stick" ? cs.halfHeadStick : cs.halfHeadFilled;
  const top = message.half !== BOTTOM;
  if (headRight) return top ? table.rightTop : table.rightBottom;
  return top ? table.leftTop : table.leftBottom;
};

export function drawMessage(
  canvas: Canvas,
  sourceCol: number,
  targetCol: number,
  row: number,
  message: Message,
  label: string,
  cs: CharSet,
  bandOf: (row: number, col: number) => BandCell | undefined
): void {
  const left = Math.min(sourceCol, targetCol);
  const right = Math.max(sourceCol, targetCol);
  const rightward = targetCol > sourceCol;
  const headRight = message.reversed === true ? !rightward : rightward;
  const [hChar] = lineStrokes(cs, message.lineType === DOTTED);

  const askedLeft = rightward ? message.dotSource === true : message.dotTarget === true;
  const askedRight = rightward ? message.dotTarget === true : message.dotSource === true;
  const bandLeft = bandOf(row, left);
  const bandRight = bandOf(row, right);
  let near = left;
  let far = right;
  const takesLeft = (askedLeft || bandLeft !== undefined) && far - near >= 2;
  if (takesLeft) near += 1;
  const takesRight = (askedRight || bandRight !== undefined) && far - near >= 2;
  if (takesRight) far -= 1;

  canvas.putRow(row, near + 1, far, hChar, false, EDGE);

  const head = (col: number, ch: string): void => canvas.put(row, col, ch, false, STYLE_ARROW);
  const tail = (col: number): void => canvas.put(row, col, hChar, false, EDGE);
  const pointing = (): void => {
    head(headRight ? far : near, headRight ? cs.arrowRight : cs.arrowLeft);
    tail(headRight ? near : far);
  };
  const halfPointing = (): void => {
    const at = headRight ? far - 1 : near + 1;
    if (at <= near || at >= far) {
      head(headRight ? far : near, halfHead(message, headRight, cs));
      tail(headRight ? near : far);
      return;
    }
    head(at, halfHead(message, headRight, cs));
    tail(headRight ? near : far);
  };

  if (message.arrowType === "bidirectional") {
    head(near, cs.arrowLeft);
    head(far, cs.arrowRight);
  } else if (message.arrowType === "arrow") {
    pointing();
  } else if (message.arrowType === "half" || message.arrowType === "stick") {
    halfPointing();
  } else if (message.arrowType === "cross") {
    head(headRight ? far : near, cs.crossHead);
    tail(headRight ? near : far);
  } else if (message.arrowType === "async") {
    head(headRight ? far : near, headRight ? cs.asyncHeadRight : cs.asyncHeadLeft);
    tail(headRight ? near : far);
  } else {
    tail(near);
    tail(far);
  }

  const band = (col: number, cell: BandCell | undefined, arm: keyof BandArms): void => {
    if (cell === undefined) return;
    canvas.put(row, col, bandGlyph(cell, arm, cs), false, STYLE_ACTIVE);
  };
  if (takesLeft) band(left, bandLeft, "right");
  if (takesRight) band(right, bandRight, "left");
  for (let c = near + 1; c < far; c++) band(c, bandOf(row, c), "both");

  const dot = cs.circleEndpoint;
  if (askedLeft && takesLeft) canvas.put(row, left, dot, false, STYLE_ARROW);
  if (askedRight && takesRight) canvas.put(row, right, dot, false, STYLE_ARROW);

  const lines = labelLines(label);
  lines.forEach((line, i) => canvas.putText(row - lines.length + i, left + 2, line, EDGE_LABEL));
}

export function drawSelfMessage(
  canvas: Canvas,
  col: number,
  row: number,
  message: Message,
  label: string,
  cs: CharSet,
  bandOf: (row: number, col: number) => BandCell | undefined,
  rounded: boolean
): void {
  const width = SELF_LOOP_MIN;
  const [hChar, vChar] = lineStrokes(cs, message.lineType === DOTTED);
  const rightCol = col + width - 1;

  const back = message.arrowType === "bidirectional" ? row + 2 : row + 1;

  canvas.putRow(row, col + 1, col + width, hChar, false, EDGE);
  canvas.putColumn(rightCol, row + 1, back + 1, vChar, false, EDGE);
  canvas.putRow(back, col + 1, col + width, hChar, false, EDGE);

  const headRow = message.reversed === true ? row : back;
  const otherRow = message.reversed === true ? back : row;
  const dotOn = (at: number): boolean =>
    at === row ? message.dotSource === true : message.dotTarget === true;
  const marked = (at: number): boolean => dotOn(at) || bandOf(at, col) !== undefined;
  const headCol = marked(headRow) ? col + 1 : col;
  const arrowType = message.arrowType;
  if (arrowType === "arrow" || arrowType === "half" || arrowType === "stick") {
    const glyph =
      arrowType === "arrow" ? cs.arrowLeft : halfHead(message, false, cs);
    canvas.put(headRow, headCol, glyph, false, STYLE_ARROW);
    if (message.reversed === true) canvas.put(otherRow, col, hChar, false, EDGE);
  } else if (arrowType === "cross") canvas.put(back, marked(back) ? col + 1 : col, cs.crossHead, false, STYLE_ARROW);
  else if (arrowType === "async")
    canvas.put(back, marked(back) ? col + 1 : col, cs.asyncHeadLeft, false, STYLE_ARROW);
  else if (arrowType === "bidirectional") {
    canvas.put(row, marked(row) ? col + 1 : col, cs.arrowLeft, false, STYLE_ARROW);
    canvas.put(back, marked(back) ? col + 1 : col, cs.arrowLeft, false, STYLE_ARROW);
  } else canvas.put(back, marked(back) ? col + 1 : col, hChar, false, EDGE);

  for (const at of [row, back]) {
    const cell = bandOf(at, col);
    if (cell !== undefined) canvas.put(at, col, bandGlyph(cell, "right", cs), false, STYLE_ACTIVE);
  }
  const loopDot = cs.circleEndpoint;
  if (message.dotSource === true) canvas.put(row, col, loopDot, false, STYLE_ARROW);
  if (message.dotTarget === true) canvas.put(back, col, loopDot, false, STYLE_ARROW);

  const [, topRight, , bottomRight] = cornersOf(cs, rounded);
  canvas.put(row, rightCol, topRight, false, EDGE);
  canvas.put(back, rightCol, bottomRight, false, EDGE);

  const lines = labelLines(label);
  lines.forEach((line, i) => {
    const at = row - lines.length + i;
    const left = selfLabelLeft(col, displayWidth(line));
    clearRect(canvas, at, left, 1, displayWidth(line));
    canvas.putText(at, left, line, EDGE_LABEL);
  });
}
