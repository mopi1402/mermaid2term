import { clearRect } from "../../canvas/cells.js";
import { cornersOf } from "../../canvas/corners.js";
import { ROUND_LEFT, ROUND_RIGHT, type ShapeRenderer, drawLabel, frame } from "../../canvas/shape-frame.js";
import { NodeShape } from "../shapes.js";
import { drawDisplay } from "./angles.js";
import { drawRectangle, drawRounded, drawStadium, outlined } from "./boxes.js";
import type { CharSet } from "../../canvas/model.js";
import { displayWidth } from "../../text/width.js";

// mermaid's Stored Data: both ends bow the same way, the left one out and the right one in.
const drawStoredData = outlined((cs) => cornersOf(cs, true), () => [ROUND_LEFT, ROUND_LEFT]);

// mermaid's Delay: square on the left, round on the right.
const drawDelay = outlined(
  (cs) => [cs.topLeft, cs.roundTopRight, cs.bottomLeft, cs.roundBottomRight],
  (cs) => [cs.vertical, ROUND_RIGHT]
);

// mermaid's Data Store: a lid and a floor, open at both ends.
const drawDataStore: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  canvas.drawHorizontal(y, x, x + width - 1, cs.horizontal, style);
  canvas.drawHorizontal(y + height - 1, x, x + width - 1, cs.horizontal, style);
  drawLabel(canvas, x, y, width, height, label, style, labelStyle);
};

const TAB_SHARE = 0.38;

// mermaid's Folder: a tab on the left of the lid, the lid itself a row lower.
const drawFolder: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  const right = x + width - 1;
  const tab = x + Math.max(2, Math.floor(width * TAB_SHARE));
  if (height < 4 || tab >= right - 1) {
    drawRectangle(canvas, x, y, width, height, label, cs, style, labelStyle);
    return;
  }
  // The body's own frame, opened under the tab so the two make one outline.
  frame(canvas, x, y + 1, width, height - 1, cs, style, cornersOf(cs, false));
  clearRect(canvas, y + 1, x, 1, tab - x + 1);
  canvas.put(y + 1, x, cs.vertical, true, style);
  canvas.put(y + 1, tab, cs.bottomLeft, true, style);
  canvas.put(y, x, cs.topLeft, true, style);
  canvas.drawHorizontal(y, x + 1, tab - 1, cs.horizontal, style);
  canvas.put(y, tab, cs.topRight, true, style);
  drawLabel(canvas, x, y + 1, width, height - 1, label, style, labelStyle);
};

// A window: a rounded frame with its sign written into the lid, left.
const windowed =
  (sign: (cs: CharSet) => string): ShapeRenderer =>
  (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
    drawRounded(canvas, x, y, width, height, label, cs, style, labelStyle);
    const text = sign(cs);
    if (width - 2 > displayWidth(text)) canvas.putText(y, x + 1, text, labelStyle ?? style);
  };

// mermaid's Person: a head over a rounded body.
const drawPerson: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  drawRounded(canvas, x, y, width, height, label, cs, style, labelStyle);
  canvas.put(y, x + Math.floor(width / 2), cs.actorHead, false, style);
};

// mermaid's Cloud: a pill whose lid and floor puff out.
const drawCloud: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  drawStadium(canvas, x, y, width, height, label, cs, style, labelStyle);
  for (let c = x + 1; c < x + width - 1; c++) {
    canvas.put(y, c, cs.drum.tie, false, style);
    canvas.put(y + height - 1, c, cs.drum.undertie, false, style);
  }
};

// mermaid's Bang: spikes all round.
const drawBang: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  const bottom = y + height - 1;
  for (let c = x; c < x + width; c++) {
    const even = (c - x) % 2 === 0;
    canvas.put(y, c, even ? cs.slopeRise : cs.slopeFall, false, style);
    canvas.put(bottom, c, even ? cs.slopeFall : cs.slopeRise, false, style);
  }
  for (let r = y + 1; r < bottom; r++) {
    canvas.put(r, x, cs.hexPointLeft, false, style);
    canvas.put(r, x + width - 1, cs.hexPointRight, false, style);
  }
  drawLabel(canvas, x, y, width, height, label, style, labelStyle);
};

export const OUTLINE_RENDERERS: ReadonlyMap<NodeShape, ShapeRenderer> = new Map([
  [NodeShape.STORED_DATA, drawStoredData],
  [NodeShape.DELAY, drawDelay],
  [NodeShape.DISPLAY, drawDisplay],
  [NodeShape.DATA_STORE, drawDataStore],
  [NodeShape.FOLDER, drawFolder],
  [NodeShape.CONSOLE, windowed((cs) => cs.signs.prompt)],
  [NodeShape.BROWSER, windowed((cs) => cs.foldMark)],
  [NodeShape.PERSON, drawPerson],
  [NodeShape.CLOUD, drawCloud],
  [NodeShape.BANG, drawBang],
]);
