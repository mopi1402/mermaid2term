import type { Canvas } from "../../canvas/canvas.js";
import type { CharSet } from "../../canvas/model.js";
import { type ShapeRenderer } from "../../canvas/shape-frame.js";
import { drawDividedRectangle, drawRectangle, lined } from "./boxes.js";
import { NodeShape } from "../shapes.js";

// A rule that rises and falls one cell at a time, the drum's tie and undertie taken in turn.
function wave(canvas: Canvas, row: number, from: number, to: number, cs: CharSet, style: string): void {
  for (let c = from; c <= to; c++) canvas.put(row, c, (c - from) % 2 === 1 ? cs.drum.tie : cs.drum.undertie, false, style);
}

// mermaid's Document: a sheet whose foot waves.
const drawDocument: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  drawRectangle(canvas, x, y, width, height, label, cs, style, labelStyle);
  wave(canvas, y + height - 1, x + 1, x + width - 2, cs, style);
};

// mermaid's Paper Tape: the head and the foot both wave, in step.
const drawPaperTape: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  drawDocument(canvas, x, y, width, height, label, cs, style, labelStyle);
  wave(canvas, y, x + 1, x + width - 2, cs, style);
};

// The corner a tagged shape folds, bottom right.
const tagged =
  (outline: ShapeRenderer): ShapeRenderer =>
  (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
    outline(canvas, x, y, width, height, label, cs, style, labelStyle);
    canvas.put(y + height - 1, x + width - 1, cs.signs.tagCorner, false, style);
  };

// A second sheet a column right and a row up, its lid and right wall ending on the front sheet, never across it.
const stacked =
  (outline: ShapeRenderer): ShapeRenderer =>
  (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
    if (width < 4 || height < 4) {
      outline(canvas, x, y, width, height, label, cs, style, labelStyle);
      return;
    }
    const right = x + width - 1;
    const bottom = y + height - 1;
    outline(canvas, x, y + 1, width - 1, height - 1, label, cs, style, labelStyle);
    canvas.put(y, x + 1, cs.topLeft, true, style);
    canvas.drawHorizontal(y, x + 2, right - 1, cs.horizontal, style);
    canvas.put(y, right, cs.topRight, true, style);
    canvas.drawVertical(right, y + 1, bottom - 1, cs.vertical, style);
    canvas.put(bottom, right, cs.bottomRight, true, style);
    canvas.put(y + 1, x + 1, cs.teeUp, true, style);
    canvas.put(bottom, right - 1, cs.teeUp, true, style);
  };

export const SHEET_RENDERERS: ReadonlyMap<NodeShape, ShapeRenderer> = new Map([
  [NodeShape.DOCUMENT, drawDocument],
  [NodeShape.LINED_DOCUMENT, lined(drawDocument)],
  [NodeShape.TAGGED_DOCUMENT, tagged(drawDocument)],
  [NodeShape.STACKED_DOCUMENT, stacked(drawDocument)],
  [NodeShape.TAGGED_RECTANGLE, tagged(drawRectangle)],
  [NodeShape.STACKED_RECTANGLE, stacked(drawRectangle)],
  [NodeShape.PAPER_TAPE, drawPaperTape],
  [NodeShape.WINDOW_PANE, lined(drawDividedRectangle, 1)],
]);
