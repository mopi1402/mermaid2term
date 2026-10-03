import { ROUND_LEFT, ROUND_RIGHT, dividerRow, drawLabel, frame, onFill, type ShapeRenderer } from "../../canvas/shape-frame.js";
import { cornersOf } from "../../canvas/corners.js";
import type { CharSet } from "../../canvas/model.js";
import { NodeShape } from "../shapes.js";

type Sides = readonly [left: string, right: string];

// A frame on the four corners and the two sides it is given, its label in the middle.
export const outlined =
  (corners: (cs: CharSet) => readonly [string, string, string, string], sides?: (cs: CharSet) => Sides): ShapeRenderer =>
  (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
    frame(canvas, x, y, width, height, cs, style, corners(cs), sides?.(cs));
    drawLabel(canvas, x, y, width, height, label, style, labelStyle);
  };

export const drawRectangle = outlined((cs) => cornersOf(cs, false));

// mermaid's Text Block: the label alone, no outline and no fill behind it.
const drawText: ShapeRenderer = (canvas, x, y, width, height, label, _cs, style = "", labelStyle) => {
  drawLabel(canvas, x, y, width, height, label, style, labelStyle);
};

export const drawRounded = outlined((cs) => cornersOf(cs, true));

export const drawStadium = outlined((cs) => cornersOf(cs, true), (): Sides => [ROUND_LEFT, ROUND_RIGHT]);

const drawSubroutine: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  drawRectangle(canvas, x, y, width, height, label, cs, style, labelStyle);
  if (width <= 4) return;
  for (let r = y + 1; r < y + height - 1; r++) {
    canvas.put(r, x + 1, cs.vertical, true, onFill(style));
    canvas.put(r, x + width - 2, cs.vertical, true, onFill(style));
  }
};

export const drawDividedRectangle: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  frame(canvas, x, y, width, height, cs, style, cornersOf(cs, false));
  const rule = y + 1;
  if (rule < y + height - 1) {
    dividerRow(canvas, rule, x, width, style, [cs.teeRight, cs.teeLeft], cs.horizontal, onFill(style));
    drawLabel(canvas, x, rule, width, height - 1, label, style, labelStyle);
    return;
  }
  drawLabel(canvas, x, y, width, height, label, style, labelStyle);
};

// The line a lined shape runs down inside its left wall, below the rows the outline keeps for itself, the label
// centred in the columns right of it.
export const lined =
  (outline: ShapeRenderer, kept = 0): ShapeRenderer =>
  (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
    if (width <= 3) {
      outline(canvas, x, y, width, height, label, cs, style, labelStyle);
      return;
    }
    outline(canvas, x, y, width, height, "", cs, style, labelStyle);
    const seat = kept < height - 1 ? kept : 0;
    drawLabel(canvas, x + 1, y + seat, width - 1, height - seat, label, style, labelStyle);
    canvas.putColumn(x + 1, y + 1 + kept, y + height - 1, cs.vertical, true, onFill(style));
  };

const drawLinedRectangle = lined(drawRectangle);

const NOTCH_COLUMNS = 2;

interface Notches {
  // The columns the left notch takes, the slope standing on the last of them.
  readonly left: (width: number) => number;
  readonly right: boolean;
  // The rule under a wide left notch, the lower half of a sloped lid.
  readonly low: boolean;
}

// A lid cut at its corners: the card's left one, the loop limit's both, the manual input's across half the width.
const notched =
  ({ left: leftOf, right: cutRight, low }: Notches): ShapeRenderer =>
  (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
    const bottom = y + height - 1;
    const right = x + width - 1;
    const notch = Math.min(leftOf(width), Math.max(width - 2, 0));
    const lidEnd = cutRight ? right - 1 : right;

    canvas.putRow(y, x + notch, lidEnd, cs.ruleFloor, true, style);
    if (low) canvas.putRow(y + 1, x, x + notch - 1, cs.ruleFloor, true, style);
    canvas.put(y + 1, x + Math.max(notch - 1, 1), cs.slopeRise, true, style);
    if (cutRight) canvas.put(y + 1, right - 1, cs.slopeFall, true, style);
    for (let r = y + 1; r < bottom; r++) {
      if (r > y + 1) canvas.put(r, x, cs.vertical, true, style);
      if (r > y + 1 || !cutRight) canvas.put(r, right, cs.vertical, true, style);
    }
    canvas.put(bottom, x, cs.bottomLeft, true, style);
    canvas.put(bottom, right, cs.bottomRight, true, style);
    canvas.putRow(bottom, x + 1, right, cs.horizontal, true, style);

    drawLabel(canvas, x, y + 1, width, height - 1, label, style, labelStyle);
  };

const drawNotchedRectangle = notched({ left: () => NOTCH_COLUMNS, right: false, low: false });

const drawNotchedPentagon = notched({ left: () => NOTCH_COLUMNS, right: true, low: false });

const drawSlopedRectangle = notched({ left: (width) => Math.floor(width / 2), right: false, low: true });

export const BOX_RENDERERS: ReadonlyMap<NodeShape, ShapeRenderer> = new Map([
  [NodeShape.RECTANGLE, drawRectangle],
  [NodeShape.NOTE, drawRectangle],
  [NodeShape.TEXT, drawText],
  [NodeShape.ROUNDED, drawRounded],
  [NodeShape.STADIUM, drawStadium],
  [NodeShape.SUBROUTINE, drawSubroutine],
  [NodeShape.DIVIDED_RECTANGLE, drawDividedRectangle],
  [NodeShape.LINED_RECTANGLE, drawLinedRectangle],
  [NodeShape.NOTCHED_RECTANGLE, drawNotchedRectangle],
]);

export const CUT_LID_RENDERERS: ReadonlyMap<NodeShape, ShapeRenderer> = new Map([
  [NodeShape.SLOPED_RECTANGLE, drawSlopedRectangle],
  [NodeShape.NOTCHED_PENTAGON, drawNotchedPentagon],
]);
