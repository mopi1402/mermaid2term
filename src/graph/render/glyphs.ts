import { Canvas } from "../../canvas/canvas.js";
import { thickStub } from "../../canvas/alphabet.js";
import { ArrowType, EdgeStyle, type Graph } from "../model.js";

import { type CharSet } from "../../canvas/model.js";
import { type RoutedEdge } from "../routing/routed.js";
import { AttachDir } from "../sides.js";
import { NodeShape } from "../shapes.js";

import { type Point } from "../../canvas/cells.js";
import { cornerOf, teeToward, towardOf, type Toward } from "../../canvas/corners.js";
import { EDGE as STYLE_EDGE, EDGE_LABEL, LINK_STYLE_PREFIX } from "../../canvas/keys.js";
import { chipKey, putLabelRows } from "../../canvas/chip.js";
import { lineStrokes } from "../../canvas/strokes.js";

const DEFAULT_LINK_STYLE = -1;

export function edgeStyleKey(graph: Graph, re: RoutedEdge): string {
  if (graph.linkStyles.has(re.index) || graph.linkStyles.has(DEFAULT_LINK_STYLE)) return LINK_STYLE_PREFIX + re.index;
  return STYLE_EDGE;
}

export function putEdgeLabel(canvas: Canvas, row: number, col: number, label: string, key: string): void {
  putLabelRows(canvas, row, col, label, chipKey(key));
}

export function labelStyleKey(graph: Graph, re: RoutedEdge): string {
  const key = edgeStyleKey(graph, re);
  return key === STYLE_EDGE ? EDGE_LABEL : key;
}

export function edgeLineChars(style: EdgeStyle, cs: CharSet): [string, string] {
  if (style === EdgeStyle.THICK) return [cs.lineThickH, cs.lineThickV];
  if (style === EdgeStyle.INVISIBLE) return [" ", " "];
  return lineStrokes(cs, style === EdgeStyle.DOTTED);
}

export function drawDiagonal(canvas: Canvas, x1: number, y1: number, x2: number, y2: number, ch: string): void {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  if (steps === 0) return;
  for (let step = 0; step <= steps; step++) {
    canvas.put(y1 + Math.floor(((y2 - y1) * step) / steps), x1 + Math.floor(((x2 - x1) * step) / steps), ch);
  }
}

export function cornerChar(
  prev: Point,
  current: Point,
  next: Point,
  cs: CharSet,
  rounded: boolean,
  style: EdgeStyle
): string | undefined {
  if (style === EdgeStyle.INVISIBLE) return undefined;

  const inward = towardOf(Math.sign(current[0] - prev[0]), Math.sign(current[1] - prev[1]));
  const outward = towardOf(Math.sign(next[0] - current[0]), Math.sign(next[1] - current[1]));
  if (inward === undefined || outward === undefined) return undefined;
  return cornerOf(inward, outward, cs, rounded, style === EdgeStyle.THICK);
}

export function drawArrowHead(canvas: Canvas, from: Point, to: Point, cs: CharSet, style: string, type: ArrowType, flush = false, onFrame = false): void {
  const ndx = Math.sign(to[0] - from[0]);
  const ndy = Math.sign(to[1] - from[1]);
  const ax = flush ? to[0] : to[0] - ndx;
  const ay = flush ? to[1] : to[1] - ndy;
  const glyph = headGlyph(cs, type, ndx, ndy);
  if (glyph === undefined) return;
  if (onFrame) {
    canvas.recast(ay, ax, glyph);
    canvas.setStyle(ay, ax, style);
    return;
  }
  canvas.put(ay, ax, glyph, true, style);
}

export function headGlyph(cs: CharSet, type: ArrowType, ndx: number, ndy: number): string | undefined {
  if (type === ArrowType.CIRCLE) return cs.circleEndpoint;
  if (type === ArrowType.CROSS) return cs.crossEndpoint;
  const heading = headingOf(ndx, ndy);
  return heading === undefined ? undefined : arrowToward(cs, heading);
}

// The way a step heads, a diagonal read by its sideways part.
const headingOf = (dx: number, dy: number): Toward | undefined => (dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : dy < 0 ? "up" : undefined);

// The plain arrowhead pointing the way a line heads.
export const arrowToward = (cs: CharSet, heading: Toward): string =>
  heading === "right" ? cs.arrowRight : heading === "left" ? cs.arrowLeft : heading === "down" ? cs.arrowDown : cs.arrowUp;

export const borderSide = (nodeId: string, dir: AttachDir): string => `${nodeId}|${dir}`;

export function markedSides(routed: RoutedEdge[]): Set<string> {
  const sides = new Set<string>();
  for (const re of routed) {
    if (re.drawPath.length < 2) continue;
    if (!re.edge.hasArrowStart) sides.add(borderSide(re.edge.source, re.startDir));
    if (!re.edge.hasArrowEnd) sides.add(borderSide(re.edge.target, re.endDir));
  }
  return sides;
}

// Whether a line leaving a shape starts on a wall a tee is cut into, through its lid or floor or through a side.
// A Text Block has no outline at all, a Data Store none at its two ends: a line leaving there starts on no wall.
export const walledShape = (shape: NodeShape | undefined, lidOrFloor: boolean): boolean =>
  shape === NodeShape.DATA_STORE ? lidOrFloor : shape !== NodeShape.TEXT;

export function drawBoxStart(
  canvas: Canvas,
  at: Point,
  next: Point,
  cs: CharSet,
  hasArrow: boolean,
  marked = false,
  thick = false
): void {
  if (hasArrow && !marked) return;
  const dx = next[0] - at[0];
  const dy = next[1] - at[1];
  const toward = headingOf(dx, dy);
  if (toward === undefined) return;
  canvas.put(at[1], at[0], teeToward(cs, toward));
  if (!thick) return;
  const heavy = thickStub(canvas.get(at[1], at[0]));
  if (heavy !== undefined) canvas.recast(at[1], at[0], heavy);
}
