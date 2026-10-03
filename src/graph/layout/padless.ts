import { EdgeStyle, isHorizontal, nodeProps, normalized, type Edge, type Graph, type Node } from "../model.js";
import { NodeShape } from "../shapes.js";
import { AttachDir } from "../sides.js";
import { axisOf } from "../axis.js";
import { edgeSides } from "./edges.js";
import { everySubgraph } from "../subgraph-tree.js";
import { labelLines } from "../../text/labels.js";
import type { GridLayout } from "./grid.js";
import { PROP_STROKE_DASHARRAY } from "../../source/css.js";
import { type DrumSeat, TightAxis, DrumRim, DrumAnchor } from "./laid.js";


export const TIGHT_SHAPES: ReadonlySet<NodeShape> = new Set([
  NodeShape.RECTANGLE,
  NodeShape.ROUNDED,
  NodeShape.DIAMOND,
  NodeShape.CIRCLE,
  NodeShape.DOUBLE_CIRCLE,
  NodeShape.NOTE,
]);

// The sides each edge was drawn on, where a first routing has them: the form follows the drawing, not the guess.
export type DrawnSides = ReadonlyMap<Edge, readonly [AttachDir, AttachDir]>;

export function tightAxes(graph: Graph, layout: GridLayout, paddingY: number, drawn?: DrawnSides): Map<string, TightAxis> {
  const direction = normalized(graph.direction);
  const flowAxis = isHorizontal(direction) ? TightAxis.HORIZONTAL : TightAxis.VERTICAL;
  const onWalls = new Map<string, number>();
  const onRules = new Map<string, number>();
  const count = (id: string, side: AttachDir): void => {
    const tally = side === AttachDir.LEFT || side === AttachDir.RIGHT ? onWalls : onRules;
    tally.set(id, (tally.get(id) ?? 0) + 1);
  };
  for (const { edge, from, to } of edgeSides(graph, layout)) {
    const sides = drawn?.get(edge);
    if (from !== undefined) count(edge.source, sides?.[0] ?? from);
    if (to !== undefined) count(edge.target, sides?.[1] ?? to);
  }
  // `edgeSides` names the side of a PLACED node alone, and drops an edge whose two ends are containers, so a
  // container never reached the tally that gives a box its form: the flow leaves it on the side it goes to and
  // reaches it on the side it comes from, which is what a placed node at either end is given there.
  const axis = axisOf(direction);
  for (const edge of graph.edges) {
    if (edge.style === EdgeStyle.INVISIBLE) continue;
    if (edge.sourceIsSubgraph) count(edge.source, axis.ahead);
    if (edge.targetIsSubgraph) count(edge.target, axis.behind);
  }
  const axes = new Map<string, TightAxis>();
  const chosen = (id: string): TightAxis =>
    paddingY === 0
      ? flowAxis
      : (onWalls.get(id) ?? 0) > (onRules.get(id) ?? 0)
        ? TightAxis.HORIZONTAL
        : TightAxis.VERTICAL;
  for (const id of graph.nodeOrder) {
    const node = graph.nodes.get(id);
    if (node === undefined || !TIGHT_SHAPES.has(node.shape) || dashed(graph, node)) continue;
    axes.set(id, chosen(id));
  }
  // A container draws the same rectangle as a box, so it takes its form the same way. One that carries no link of
  // its own has nothing to weigh and spans along the flow by construction, which is the reading a box is given
  // where there is no padding to spend. A concurrent one keeps its dashes and no tight frame.
  for (const sg of everySubgraph(graph)) {
    if (sg.concurrent) continue;
    const linked = (onWalls.get(sg.id) ?? 0) + (onRules.get(sg.id) ?? 0) > 0;
    axes.set(sg.id, linked ? chosen(sg.id) : flowAxis);
  }
  return axes;
}

export function drumExtent(seat: DrumSeat, y: number, height: number): { top: number; rows: number } {
  const rows = seat.lines + 3;
  if (height < rows) return { top: seat.rim === DrumRim.ABOVE ? y - 1 : y, rows };
  if (seat.anchor === DrumAnchor.STRETCH || seat.anchor === DrumAnchor.SPAN) return { top: y, rows: height };
  return { top: seat.anchor === DrumAnchor.TOP ? y : y + height - rows, rows };
}

export function drumWalls(seat: DrumSeat, y: number, height: number): [number, number] {
  const { top, rows } = drumExtent(seat, y, height);
  return seat.rim === DrumRim.ABOVE ? [top + 2, top + rows - 2] : [top + 1, top + rows - 2];
}

export const drumBorrows = (label: string, height: number): boolean => height < labelLines(label) + 3;

export function drumSeats(graph: Graph, layout: GridLayout): Map<string, DrumSeat> {
  const drums = new Set<string>();
  for (const id of graph.nodeOrder) if (graph.nodes.get(id)?.shape === NodeShape.CYLINDER) drums.add(id);
  const seats = new Map<string, DrumSeat>();
  if (drums.size === 0) return seats;
  const tally = (): Map<string, number> => new Map<string, number>();
  const headsAbove = tally();
  const headsBelow = tally();
  const endsAbove = tally();
  const endsBelow = tally();
  const endsBeside = tally();
  const count = (id: string, side: AttachDir, head: boolean): void => {
    if (!drums.has(id)) return;
    const above = side === AttachDir.TOP;
    if (!above && side !== AttachDir.BOTTOM) {
      endsBeside.set(id, (endsBeside.get(id) ?? 0) + 1);
      return;
    }
    const ends = above ? endsAbove : endsBelow;
    ends.set(id, (ends.get(id) ?? 0) + 1);
    if (!head) return;
    const heads = above ? headsAbove : headsBelow;
    heads.set(id, (heads.get(id) ?? 0) + 1);
  };
  for (const { edge, from, to } of edgeSides(graph, layout)) {
    if (from !== undefined) count(edge.source, from, edge.hasArrowStart);
    if (to !== undefined) count(edge.target, to, edge.hasArrowEnd);
  }
  for (const id of drums) {
    const up = headsAbove.get(id) ?? 0;
    const down = headsBelow.get(id) ?? 0;
    const rim = up > 0 && up >= down ? DrumRim.BELOW : DrumRim.ABOVE;
    const attachedAbove = (endsAbove.get(id) ?? 0) > 0;
    const attachedBelow = (endsBelow.get(id) ?? 0) > 0;
    const attachedBeside = (endsBeside.get(id) ?? 0) > 0;
    const anchor =
      attachedAbove && attachedBelow
        ? DrumAnchor.STRETCH
        : attachedBeside
          ? DrumAnchor.SPAN
          : attachedBelow
            ? DrumAnchor.BOTTOM
            : DrumAnchor.TOP;
    seats.set(id, { rim, anchor, lines: labelLines(layout.labels.get(id) ?? "") });
  }
  return seats;
}

const WALLS_ADVANCE: ReadonlySet<NodeShape> = new Set([NodeShape.SUBROUTINE]);
const RULES_ADVANCE: ReadonlySet<NodeShape> = new Set([
  ...WALLS_ADVANCE,
  NodeShape.LINED_RECTANGLE,
  NodeShape.NOTCHED_RECTANGLE,
  NodeShape.ASYMMETRIC,
  NodeShape.PARALLELOGRAM,
  NodeShape.PARALLELOGRAM_ALT,
  NodeShape.TRAPEZOID,
  NodeShape.TRAPEZOID_ALT,
]);

function dashed(graph: Graph, node: Node): boolean {
  return nodeProps(graph, node.id, node.styleClasses)?.has(PROP_STROKE_DASHARRAY) === true;
}

export function headAdvances(graph: Graph, layout: GridLayout, node: Node, sideways: boolean, paddingX: number): boolean {
  if (dashed(graph, node)) return false;
  const axis = layout.tightAxes.get(node.id);
  // A closed-up box takes its wall from `tightenFrame`, which inks the OUTER edge of the wall column on a rounded box
  // and the inner one on a square box. Outer, a head stopping outside already touches the wall and taking its column
  // would jog the outline for that one row; inner, the ink stands a cell in and only a head ON the column reaches it,
  // the wall moving to the neighbouring cell's far edge, which is the same vertical line.
  if (axis === TightAxis.VERTICAL) return sideways && node.shape !== NodeShape.ROUNDED;
  if (axis === TightAxis.HORIZONTAL) return !sideways;
  if (sideways) return WALLS_ADVANCE.has(node.shape) && paddingX >= 1;
  return RULES_ADVANCE.has(node.shape);
}

const HUGGING_WALLS: ReadonlySet<NodeShape> = new Set([
  NodeShape.SUBROUTINE,
  NodeShape.LINED_RECTANGLE,
  NodeShape.DIVIDED_RECTANGLE,
  NodeShape.NOTCHED_RECTANGLE,
  NodeShape.ASYMMETRIC,
]);
export function wallHugsContent(node: Node, layout: GridLayout, padless: boolean): boolean {
  if (!padless) return false;
  const axis = layout.tightAxes.get(node.id);
  if (axis !== undefined) return axis === TightAxis.VERTICAL;
  return HUGGING_WALLS.has(node.shape);
}

export function wallPadding(node: Node, layout: GridLayout, padless: boolean): number {
  return wallHugsContent(node, layout, padless) ? 2 : 0;
}
