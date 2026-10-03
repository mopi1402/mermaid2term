import type { Canvas } from "../../canvas/canvas.js";
import type { CharSet } from "../../canvas/model.js";
import { type ShapeRenderer, drawLabel } from "../../canvas/shape-frame.js";

function brace(
  canvas: Canvas,
  col: number,
  y: number,
  height: number,
  cs: CharSet,
  right: boolean,
  style: string
): void {
  const bottom = y + height - 1;
  const waist = y + Math.floor((height - 1) / 2);
  const side = right ? cs.braceRight : cs.braceLeft;
  const nib = side.waist;
  const stem = cs.braceStem;
  const top = side.top;
  const foot = side.foot;
  for (let r = y; r <= bottom; r++) {
    canvas.put(r, col, r === waist ? nib : r === y ? top : r === bottom ? foot : stem, false, style);
  }
}

function braced(left: boolean, right: boolean): ShapeRenderer {
  return (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
    if (left) brace(canvas, x, y, height, cs, false, style);
    if (right) brace(canvas, x + width - 1, y, height, cs, true, style);
    drawLabel(canvas, x, y, width, height, label, style, labelStyle);
  };
}

export const drawBraceLeft = braced(true, false);

export const drawBraceRight = braced(false, true);

export const drawBraces = braced(true, true);
