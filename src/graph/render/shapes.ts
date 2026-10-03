import { NodeShape } from "../shapes.js";
import { labelRowsOf } from "../../text/labels.js";
import { centredAt, centredOffset } from "../../text/width.js";
import { FAINT, FOLD_TAIL } from "../../canvas/keys.js";
import { FOLD_ROWS, LABEL_STYLE, type ShapeRenderer, drawLabel, frame, putCentredLines } from "../../canvas/shape-frame.js";
import { BOX_RENDERERS, CUT_LID_RENDERERS } from "./boxes.js";
import { ANGLE_RENDERERS } from "./angles.js";
import { ROUND_RENDERERS } from "./rounds.js";
import { drawCylinder, drawHorizontalCylinder } from "./drums.js";
import { drawBraceLeft, drawBraceRight, drawBraces } from "./braces.js";
import { cornersOf } from "../../canvas/corners.js";
import { SHEET_RENDERERS } from "./sheets.js";
import { OUTLINE_RENDERERS } from "./outlines.js";

const drawCollapsedGroup: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  frame(canvas, x, y, width, height, cs, style, cornersOf(cs, true));
  const interior = height - 2;
  const lines = labelRowsOf(label);
  const rows = lines.length + FOLD_ROWS - 1;
  if (interior < rows || width < 3) {
    drawLabel(canvas, x, y, width, height, label, style, labelStyle);
    return;
  }

  const ink = labelStyle ?? (style !== "" ? LABEL_STYLE : "");
  const centred = (row: number, text: string, key: string): void =>
    canvas.putText(row, x + centredAt(width, text), text, key);

  const top = y + 1 + centredOffset(interior, rows);
  putCentredLines(canvas, top, x, width, lines, ink);
  const rule = top + lines.length;
  canvas.putRow(rule, x + 2, x + width - 2, cs.horizontal, false, style === "" ? FAINT : `${style}${FOLD_TAIL}`);
  centred(rule + 1, cs.foldMark, ink);
};

export const SHAPE_RENDERERS: ReadonlyMap<NodeShape, ShapeRenderer> = new Map([
  [NodeShape.CYLINDER, drawCylinder],
  [NodeShape.HORIZONTAL_CYLINDER, drawHorizontalCylinder],
  [NodeShape.BRACE_LEFT, drawBraceLeft],
  [NodeShape.BRACE_RIGHT, drawBraceRight],
  [NodeShape.BRACES, drawBraces],
  [NodeShape.COLLAPSED_GROUP, drawCollapsedGroup],
  ...BOX_RENDERERS,
  ...ANGLE_RENDERERS,
  ...ROUND_RENDERERS,
  ...SHEET_RENDERERS,
  ...OUTLINE_RENDERERS,
  ...CUT_LID_RENDERERS,
]);
