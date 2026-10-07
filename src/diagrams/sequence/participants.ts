import { centredOn } from "../../text/width.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import {
  ACTOR_FILL,
  ACTOR_LABEL,
  LABEL as STYLE_LABEL,
} from "../../canvas/keys.js";
import { COLLECTIONS_HEIGHT, labelLines, QUEUE_SYMBOL_W } from "./metrics.js";
import { STYLE_ACTOR } from "./ink.js";
import { drawCylinder, drawHorizontalCylinder } from "../../graph/render/drums.js";
import { fillInterior } from "../../canvas/shape-frame.js";
import { tightenFrame } from "../../canvas/fit-frame.js";
import { drawRectangle, drawRounded } from "../../graph/render/boxes.js";

function drawName(canvas: Canvas, cx: number, y: number, label: string): void {
  labelLines(label).forEach((line, at) => {
    canvas.putText(y + at, centredOn(cx, line), line, STYLE_LABEL);
  });
}

export function drawActor(canvas: Canvas, cx: number, y: number, label: string, cs: CharSet): void {
  canvas.put(y, cx, cs.actorHead, false, STYLE_ACTOR);
  canvas.put(y + 1, cx - 1, cs.horizontal, false, STYLE_ACTOR);
  canvas.put(y + 1, cx, cs.cross, false, STYLE_ACTOR);
  canvas.put(y + 1, cx + 1, cs.horizontal, false, STYLE_ACTOR);
  canvas.put(y + 2, cx - 1, "/", false, STYLE_ACTOR);
  canvas.put(y + 2, cx + 1, "\\", false, STYLE_ACTOR);
  drawName(canvas, cx, y + 3, label);
}

export function drawQueue(canvas: Canvas, cx: number, y: number, label: string, cs: CharSet) {
  const bx = cx - Math.floor(QUEUE_SYMBOL_W / 2);
  drawHorizontalCylinder(canvas, bx, y + 1, QUEUE_SYMBOL_W, 3, "", cs, STYLE_ACTOR, ACTOR_LABEL);
  fillInterior(canvas, bx, y + 1, QUEUE_SYMBOL_W, 3, ACTOR_FILL);
  drawName(canvas, cx, y + 4, label);
}

const DB_SYMBOL_W = 6;

export function drawDatabase(canvas: Canvas, cx: number, y: number, label: string, cs: CharSet): void {
  const bx = cx - Math.floor(DB_SYMBOL_W / 2);
  drawCylinder(canvas, bx, y, DB_SYMBOL_W, 4, "", cs, STYLE_ACTOR, ACTOR_LABEL);
  fillInterior(canvas, bx, y, DB_SYMBOL_W, 4, ACTOR_FILL);
  drawName(canvas, cx, y + 4, label);
}

export function drawBoundary(canvas: Canvas, cx: number, y: number, label: string, cs: CharSet): void {
  canvas.put(y, cx - 2, cs.boundaryPost, true, STYLE_ACTOR);
  canvas.put(y, cx - 1, cs.horizontal, true, STYLE_ACTOR);
  canvas.put(y, cx, cs.boundaryRing, false, STYLE_ACTOR);

  drawName(canvas, cx, y + 1, label);
}

export function drawControl(canvas: Canvas, cx: number, y: number, label: string, cs: CharSet): void {
  canvas.put(y, cx, cs.controlMark, false, STYLE_ACTOR);
  drawName(canvas, cx, y + 1, label);
}

export function drawEntity(canvas: Canvas, cx: number, y: number, label: string, cs: CharSet): void {
  const mark = [...cs.entityMark];
  const from = cx - Math.floor(mark.length / 2);
  mark.forEach((ch, at) => canvas.put(y, from + at, ch, false, STYLE_ACTOR));

  drawName(canvas, cx, y + 1, label);
}

export function drawCollections(
  canvas: Canvas,
  cx: number,
  y: number,
  width: number,
  label: string,
  cs: CharSet
): void {
  const bx = cx - Math.floor(width / 2);
  const h = COLLECTIONS_HEIGHT;
  const front = bx + width - 1;
  const behind = bx + width;
  const closes = y + h - 2;

  canvas.putRow(y, bx + 2, front + 1, cs.backRule, false, STYLE_ACTOR);
  canvas.put(y + 1, bx + 1, cs.backFoot, true, STYLE_ACTOR);
  canvas.putColumn(behind, y + 1, closes, cs.vertical, true, STYLE_ACTOR);
  canvas.put(closes, behind, cs.bottomRight, true, STYLE_ACTOR);

  drawActorBox(canvas, bx, y + 1, width, h - 1, label, cs, false);
  canvas.put(closes, front, cs.backWall, true, STYLE_ACTOR);
}

export function drawActorBox(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  cs: CharSet,
  rounded = true,
  padless = false
): void {
  // Padless keeps the SQUARE corner: its outline runs on the cell edges, where a quadrant arc would end its
  // curve a cell away from the rules that are supposed to meet it. A square box is filled all the same.
  const outline = rounded && !padless ? drawRounded : drawRectangle;
  outline(canvas, x, y, width, height, label, cs, STYLE_ACTOR, ACTOR_LABEL);
  fillInterior(canvas, x, y, width, height, ACTOR_FILL);
  if (padless) tightenFrame(canvas, y, y + height - 1, x, x + width - 1, STYLE_ACTOR, false);
}
