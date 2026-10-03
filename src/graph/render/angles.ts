import { cornersOf } from "../../canvas/corners.js";
import type { CharSet } from "../../canvas/model.js";
import { ROUND_RIGHT, type ShapeRenderer, drawLabel, frame, onFill } from "../../canvas/shape-frame.js";
import { NodeShape } from "../shapes.js";

const drawDiamond: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  const cx = x + Math.floor(width / 2);
  const marker = cs.diamondTop;
  frame(canvas, x, y, width, height, cs, style, cornersOf(cs, false));
  canvas.put(y, cx, marker, false, style);
  canvas.put(y + height - 1, cx, marker, false, style);
  drawLabel(canvas, x, y, width, height, label, style, labelStyle);
};

const drawHexagon: ShapeRenderer = (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
  const rise = cs.slopeRise;
  const fall = cs.slopeFall;
  const right = x + width - 1;
  const bottom = y + height - 1;
  const first = y + 1;
  const last = bottom - 1;
  const rows = last - first + 1;
  const upper = first + Math.ceil(rows / 2) - 1;
  const lower = first + Math.floor(rows / 2);
  const inset = (row: number): number => (row <= upper ? upper - row : row - lower);
  for (let r = first; r <= last; r++) {
    if (upper === lower && r === upper) {
      canvas.put(r, x, cs.hexPointLeft, true, style);
      canvas.put(r, right, cs.hexPointRight, true, style);
      continue;
    }
    const k = inset(r);
    canvas.put(r, x + k, r <= upper ? rise : fall, true, style);
    canvas.put(r, right - k, r <= upper ? fall : rise, true, style);
  }
  if (rows < 1) return;
  const from = inset(first) + 1;
  for (let c = x + from; c <= right - from; c++) {
    canvas.put(y, c, cs.ruleFloor, true, style);
    canvas.put(bottom, c, cs.ruleCeiling, true, style);
  }

  drawLabel(canvas, x, y, width, height, label, style, labelStyle);
};

export const FLAG_UPPER = "\\";

export const FLAG_LOWER = "/";

interface Pennant {
  readonly lidFrom: number;
  readonly upper: string;
  readonly lower: string;
  readonly tip: (cs: CharSet) => string;
  // A notched side's tip stands a column in.
  readonly notched: boolean;
  readonly rounded: boolean;
  readonly wall: (cs: CharSet) => string;
}

// A box whose left side comes to a point: in, the odd flag's notch; out, a display's pointed end.
const pennant =
  ({ lidFrom, upper, lower, tip, notched, rounded, wall }: Pennant): ShapeRenderer =>
  (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
    const right = x + width - 1;
    const bottom = y + height - 1;
    const cy = y + Math.floor(height / 2);
    const [, topRight, , bottomRight] = cornersOf(cs, rounded);
    for (let c = x + lidFrom; c < right; c++) {
      canvas.put(y, c, cs.horizontal, true, style);
      canvas.put(bottom, c, cs.horizontal, true, style);
    }
    canvas.put(y, right, topRight, true, style);
    canvas.put(bottom, right, bottomRight, true, style);
    const pointed = (height - 2) % 2 === 1;
    for (let r = y + 1; r < bottom; r++) {
      canvas.put(r, right, wall(cs), true, style);
      if (!pointed || r !== cy) canvas.put(r, x, r < cy ? upper : lower, true, style);
    }
    if (pointed && cy > y && cy < bottom) {
      const tipX = notched && bottom - y > 2 ? Math.min(x + 1, right) : x;
      canvas.put(cy, tipX, tip(cs), true, style);
    }
    drawLabel(canvas, x + 1, y, width - 1, height, label, style, labelStyle);
  };

const drawAsymmetric = pennant({
  lidFrom: 0,
  upper: FLAG_UPPER,
  lower: FLAG_LOWER,
  tip: (cs) => cs.flagTip,
  notched: true,
  rounded: false,
  wall: (cs) => cs.vertical,
});

// mermaid's Display: pointed on the left, round on the right.
export const drawDisplay = pennant({
  lidFrom: 1,
  upper: FLAG_LOWER,
  lower: FLAG_UPPER,
  tip: (cs) => cs.hexPointLeft,
  notched: false,
  rounded: true,
  wall: () => ROUND_RIGHT,
});

const enum Lean {
  RISE = "RISE",
  FALL = "FALL",
}

function sheared(left: Lean, right: Lean): ShapeRenderer {
  return (canvas, x, y, width, height, label, cs, style = "", labelStyle) => {
    const rise = cs.slopeRise;
    const fall = cs.slopeFall;
    const bottom = y + height - 1;
    const leftAt = (row: number): number => x + (left === Lean.RISE ? bottom - row : row - y);
    const rightAt = (row: number): number => x + width - 1 - (right === Lean.RISE ? row - y : bottom - row);

    for (let r = y; r <= bottom; r++) {
      canvas.put(r, leftAt(r), left === Lean.RISE ? rise : fall, true, style);
      canvas.put(r, rightAt(r), right === Lean.RISE ? rise : fall, true, style);
    }
    for (const [row, flat] of [
      [y, cs.ruleCeiling],
      [bottom, cs.ruleFloor],
    ] as const) {
      canvas.putRow(row, leftAt(row) + 1, rightAt(row), flat, true, onFill(style));
    }
    drawLabel(canvas, x, y, width, height, label, style, labelStyle);
  };
}

export const ANGLE_RENDERERS: ReadonlyMap<NodeShape, ShapeRenderer> = new Map([
  [NodeShape.DIAMOND, drawDiamond],
  [NodeShape.HEXAGON, drawHexagon],
  [NodeShape.ASYMMETRIC, drawAsymmetric],
  [NodeShape.TRAPEZOID, sheared(Lean.RISE, Lean.FALL)],
  [NodeShape.TRAPEZOID_ALT, sheared(Lean.FALL, Lean.RISE)],
  [NodeShape.PARALLELOGRAM, sheared(Lean.RISE, Lean.RISE)],
  [NodeShape.PARALLELOGRAM_ALT, sheared(Lean.FALL, Lean.FALL)],
]);
