import type { CharSet } from "../../canvas/model.js";
import { cornersOf } from "../../canvas/corners.js";
import { type ShapeRenderer, frame, marked } from "../../canvas/shape-frame.js";
import { drawRounded } from "./boxes.js";
import { NodeShape } from "../shapes.js";

const ringed =
  (pick: (cs: CharSet) => string): ShapeRenderer =>
  (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
    const cx = x + Math.floor(width / 2);
    const marker = pick(cs);
    drawRounded(canvas, x, y, width, height, label, cs, style, labelStyle);
    canvas.put(y, cx, marker, false, style);
    canvas.put(y + height - 1, cx, marker, false, style);
  };

const drawForkJoin: ShapeRenderer = (canvas, x, y, width, height, _label, cs, style = "") => {
  const bar = cs.solid;
  for (let r = y; r < y + height; r++) canvas.putRow(r, x, x + width, bar, true, style);
};

const drawOutlinedBar: ShapeRenderer = (canvas, x, y, width, height, _label, cs, style = "") => {
  if (width < 2 || height < 2) {
    for (let r = y; r < y + height; r++) {
      canvas.putRow(r, x, x + width, height < 2 ? cs.horizontal : cs.vertical, true, style);
    }
    return;
  }
  frame(canvas, x, y, width, height, cs, style, cornersOf(cs, false));
};

// A mark that says nothing beside it, whatever the node is called.
const unnamed =
  (pick: (cs: CharSet) => string): ShapeRenderer =>
  (canvas, x, y, width, height, _label, cs, style = "", labelStyle) =>
    marked(pick)(canvas, x, y, width, height, "", cs, style, labelStyle);

// A table of one mark per shape, which jscpd matches against itself a row down.
// jscpd:ignore-start
export const ROUND_RENDERERS: ReadonlyMap<NodeShape, ShapeRenderer> = new Map([
  [NodeShape.FORK_JOIN, drawForkJoin],
  [NodeShape.OUTLINED_BAR, drawOutlinedBar],
  [NodeShape.JUNCTION, () => undefined],
  [NodeShape.CIRCLE, ringed((cs) => cs.circleMark)],
  [NodeShape.DOUBLE_CIRCLE, ringed((cs) => cs.doubleCircleMark)],
  [NodeShape.SMALL_CIRCLE, marked((cs) => cs.smallCircle)],
  [NodeShape.LOLLIPOP, marked((cs) => cs.lollipopRing)],
  [NodeShape.FRAMED_CIRCLE, marked((cs) => cs.framedCircle)],
  [NodeShape.HOURGLASS, marked((cs) => cs.hourglass)],
  [NodeShape.START_STATE, marked((cs) => cs.startState)],
  [NodeShape.END_STATE, marked((cs) => cs.framedCircle)],
  [NodeShape.CHOICE_STATE, unnamed((cs) => cs.choiceMark)],
  [NodeShape.TRIANGLE, marked((cs) => cs.inheritance.up)],
  [NodeShape.FLIPPED_TRIANGLE, marked((cs) => cs.inheritance.down)],
  [NodeShape.FILLED_CIRCLE, unnamed((cs) => cs.startState)],
  [NodeShape.CROSSED_CIRCLE, unnamed((cs) => cs.signs.crossedCircle)],
  [NodeShape.LIGHTNING_BOLT, unnamed((cs) => cs.signs.bolt)],
]);
// jscpd:ignore-end
