import { labelLines } from "../../text/labels.js";
import { drumExtent } from "../layout/padless.js";
import { DrumAnchor, DrumRim, type DrumSeat } from "../layout/laid.js";
import type { Canvas } from "../../canvas/canvas.js";
import type { CharSet } from "../../canvas/model.js";
import { SPACE } from "../../text/chars.js";
import { type ShapeRenderer, drawLabel, drawSunkLabel, onFill, outside } from "../../canvas/shape-frame.js";

export const drawCylinder: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) =>
  drawDrum(canvas, x, y, width, height, label, cs, style, labelStyle);

export function drawDrum(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  cs: CharSet,
  style = "",
  labelStyle?: string,
  seat?: DrumSeat
): void {
  const floorRule = cs.ruleFloor;
  const ceilingRule = cs.ruleCeiling;
  const { wall, capWall, foot, capFoot } = cs.drum;
  const across = (row: number, glyph: string, key: string): void => {
    canvas.putRow(row, x + 1, x + width - 1, glyph, true, key);
  };
  const hairline = (row: number, glyph: string): void => {
    for (let c = x + 1; c < x + width - 1; c++) {
      if (canvas.get(row, c) === SPACE) canvas.put(row, c, glyph, true, outside(style));
    }
  };
  const walls = (row: number, left: string, right: string): void => {
    canvas.put(row, x, left, true, outside(style));
    canvas.put(row, x + width - 1, right, true, outside(style));
  };

  if (seat !== undefined) {
    const { top, rows } = drumExtent(seat, y, height);
    const lines = labelLines(label);
    const spare = rows - (lines + 3);
    const nameRow = top + 2 + (seat.anchor === DrumAnchor.SPAN ? Math.max(0, Math.floor((rows - lines) / 2) - 2) : spare);
    if (seat.rim === DrumRim.BELOW) {
      walls(top, "(", ")");
      across(top, ceilingRule, onFill(style));
      walls(top + 1, wall, capWall);
      across(top + 1, ceilingRule, onFill(style));
      for (let r = top + 2; r < nameRow + lines - 1; r++) walls(r, wall, capWall);
      walls(nameRow + lines - 1, foot, capFoot);
      hairline(nameRow + lines, ceilingRule);
      drawLabel(canvas, x, nameRow, width, lines, label, style, labelStyle);
      return;
    }
    const footRow = top + rows - 1;
    hairline(top, floorRule);
    walls(top + 1, "(", ")");
    across(top + 1, floorRule, onFill(style));
    for (let r = top + 2; r < footRow; r++) walls(r, wall, capWall);
    walls(footRow, foot, capFoot);
    across(footRow, floorRule, onFill(style));
    if (seat.anchor === DrumAnchor.SPAN) drawSunkLabel(canvas, x, top + 2, width, footRow - top - 2, label, style, labelStyle);
    else drawLabel(canvas, x, nameRow, width, lines, label, style, labelStyle);
    return;
  }

  const lidRow = height >= 4 ? y + 1 : y;
  const rimRow = lidRow - 1;
  if (rimRow >= y) across(rimRow, floorRule, outside(style));
  else hairline(rimRow, floorRule);

  walls(lidRow, "(", ")");
  across(lidRow, floorRule, onFill(style));
  for (let r = lidRow + 1; r < y + height - 1; r++) walls(r, wall, capWall);
  walls(y + height - 1, foot, capFoot);
  across(y + height - 1, floorRule, onFill(style));

  const bodyTop = lidRow + 1;
  drawSunkLabel(canvas, x, bodyTop, width, y + height - 1 - bodyTop, label, style, labelStyle);
}

export const drawHorizontalCylinder: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  const { lid, wall, foot, capLid, capWall, capFoot, tie, undertie } = cs.drum;
  const rimTop = cs.ruleCeiling;
  const rimBottom = cs.ruleFloor;
  const bottom = y + height - 1;
  const top = height >= 4 ? y + 1 : y;

  canvas.put(top, x, lid, true, outside(style));
  canvas.putColumn(x, top + 1, bottom, wall, true, outside(style));
  canvas.put(bottom, x, foot, true, outside(style));
  const seam = x + width - 3;
  canvas.put(top, seam, lid, true, onFill(style));
  canvas.putColumn(seam, top + 1, bottom, wall, true, onFill(style));
  canvas.put(bottom, seam, foot, true, onFill(style));
  canvas.put(top, x + width - 2, tie, true, onFill(style));
  for (let r = top + 1; r < bottom; r++) canvas.setStyle(r, x + width - 2, onFill(style));
  canvas.put(bottom, x + width - 2, undertie, true, onFill(style));
  canvas.put(top, x + width - 1, capLid, true, outside(style));
  canvas.putColumn(x + width - 1, top + 1, bottom, capWall, true, outside(style));
  canvas.put(bottom, x + width - 1, capFoot, true, outside(style));
  for (let c = x + 1; c <= x + width - 4; c++) {
    canvas.put(top, c, rimTop, true, onFill(style));
    canvas.put(bottom, c, rimBottom, true, onFill(style));
  }

  drawSunkLabel(canvas, x, top + 1, width - 2, bottom - top - 1, label, style, labelStyle);
};
