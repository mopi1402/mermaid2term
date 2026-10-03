import { Canvas } from "../../canvas/canvas.js";

import { EdgeStyle, isSelfReference, type Graph } from "../model.js";
import { NodeShape } from "../shapes.js";

import { type CharSet } from "../../canvas/model.js";
import { cellsOfPath, type RoutedEdge } from "../routing/routed.js";
import { pushInto } from "../../must.js";
import { type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { type PlacedLabel } from "../../canvas/cells.js";
import { borderSide, cornerChar, drawArrowHead, drawBoxStart, drawDiagonal, edgeLineChars, edgeStyleKey, labelStyleKey, markedSides, walledShape } from "./glyphs.js";
import { PLAIN_SEAT, drawEdgeLabel, pierceDrumHairline, type LabelSeat, type Misread } from "./edge-labels.js";
import { ON_THE_PAGE, type Foreign } from "./label-seats.js";
import { ARROW, EDGE as STYLE_EDGE } from "../../canvas/keys.js";
import { cellId } from "../../canvas/geometry.js";
import { CrossingCut } from "../../canvas/crossings.js";
import { HEAVY, LIGHT, NONE, weightedGlyph, type Weight } from "../../canvas/arms.js";
import { AttachDir } from "../sides.js";
import { pairOf } from "../layout/parallels.js";
import { headAdvances } from "../layout/padless.js";
import { onTightRule, subgraphLabelSpans, tightFrame } from "./frames.js";
type FlushHead = (nodeId: string, dir: AttachDir) => boolean;

const NO_FLUSH: FlushHead = () => false;

// A borderless node has no wall for an edge to cut a tee into: the stroke runs up to it and stops.
const walled = (graph: Graph, id: string, dir: AttachDir): boolean =>
  walledShape(graph.nodes.get(id)?.shape, dir === AttachDir.TOP || dir === AttachDir.BOTTOM);

export function flushHeads(graph: Graph, layout: GridLayout, padless: boolean, paddingX: number): FlushHead {
  if (!padless) return NO_FLUSH;
  return (nodeId, dir) => {
    const node = graph.nodes.get(nodeId);
    if (node === undefined) return false;
    const sideways = dir === AttachDir.LEFT || dir === AttachDir.RIGHT;
    return headAdvances(graph, layout, node, sideways, paddingX);
  };
}

export function drawEdges(
  canvas: Canvas,
  graph: Graph,
  routed: RoutedEdge[],
  cs: CharSet,
  rounded: boolean,
  layout: GridLayout,
  flush: FlushHead = NO_FLUSH,
  seat: LabelSeat = PLAIN_SEAT
): void {
  const landings = new Set<string>();
  for (const re of routed) {
    if (re.drawPath.length < 1) continue;
    for (const at of [re.drawPath[0], re.drawPath[re.drawPath.length - 1]]) {
      const [x, y] = at;
      landings.add(cellId(x, y));
    }
  }
  const crossing = new CrossingCut(landings);
  for (const re of routed) {
    if (re.drawPath.length < 2) continue;
    const key = edgeStyleKey(graph, re);
    const [hChar, vChar] = edgeLineChars(re.edge.style, cs);
    const srcRule = onTightRule(layout, re.edge.source, re.edge.sourceIsSubgraph, re.drawPath[0]);
    const srcBar = layout.placements.get(re.edge.source)?.bar === true || (re.edge.hasArrowStart && (flush(re.edge.source, re.startDir) || srcRule));
    const tgtBar = layout.placements.get(re.edge.target)?.bar === true || (re.edge.hasArrowEnd && flush(re.edge.target, re.endDir));
    const along = (x: number, y: number, alongRow: boolean): void => crossing.along(x, y, alongRow, vChar, key);

    for (let i = 0; i < re.drawPath.length - 1; i++) {
      const [fromX, fromY] = re.drawPath[i];
      const [toX, toY] = re.drawPath[i + 1];
      const dx = Math.sign(toX - fromX);
      const dy = Math.sign(toY - fromY);

      let x1 = fromX + dx;
      let y1 = fromY + dy;
      if (i === 0 && re.edge.hasArrowStart && !srcBar) {
        x1 += dx;
        y1 += dy;
      }
      const x2 = toX - dx;
      const y2 = toY - dy;

      if (dy === 0) {
        if ((dx > 0 && x1 > x2) || (dx < 0 && x1 < x2)) continue;
        canvas.drawHorizontal(y1, x1, x2, hChar, key);
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) along(x, y1, true);
      } else if (dx === 0) {
        if ((dy > 0 && y1 > y2) || (dy < 0 && y1 < y2)) continue;
        canvas.drawVertical(x1, y1, y2, vChar, key);
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) along(x1, y, false);
      } else {
        drawDiagonal(canvas, x1, y1, x2, y2, hChar);
      }
    }

    crossing.cut(canvas);

    for (let i = 1; i < re.drawPath.length - 1; i++) {
      const corner = cornerChar(
        re.drawPath[i - 1],
        re.drawPath[i],
        re.drawPath[i + 1],
        cs,
        rounded,
        re.edge.style
      );
      if (corner !== undefined) canvas.put(re.drawPath[i][1], re.drawPath[i][0], corner, true, key);
    }

    if (srcBar && !re.edge.hasArrowStart) {
      const [sx, sy] = re.drawPath[0];
      const [nx] = re.drawPath[1];
      canvas.put(sy, sx, sx === nx ? vChar : hChar, true, key);
    }
    if (tgtBar && !re.edge.hasArrowEnd) {
      const [ex, ey] = re.drawPath[re.drawPath.length - 1];
      const [px] = re.drawPath[re.drawPath.length - 2];
      canvas.put(ey, ex, ex === px ? vChar : hChar, true, key);
    }
  }

  const sides = markedSides(routed);
  for (const re of routed) {
    if (re.drawPath.length < 2) continue;
    // Before the borders are cut: an invisible link's run is drawn in blanks, which `Canvas.put` refuses, so only the
    // pair of tees its ends cut into the two boxes ever showed.
    if (re.edge.style === EdgeStyle.INVISIBLE) continue;
    const key = edgeStyleKey(graph, re);
    const arrowKey = key === STYLE_EDGE ? ARROW : key;
    const last = re.drawPath.length - 1;

    const srcRule = onTightRule(layout, re.edge.source, re.edge.sourceIsSubgraph, re.drawPath[0]);
    const tgtRule = onTightRule(layout, re.edge.target, re.edge.targetIsSubgraph, re.drawPath[last]);
    const srcOnFrame = (re.edge.hasArrowStart && flush(re.edge.source, re.startDir)) || srcRule;
    const tgtOnFrame = (re.edge.hasArrowEnd && flush(re.edge.target, re.endDir)) || tgtRule;
    const srcBar = layout.placements.get(re.edge.source)?.bar === true || srcOnFrame;
    const tgtBar = layout.placements.get(re.edge.target)?.bar === true || tgtOnFrame;
    if (re.edge.hasArrowEnd) {
      drawArrowHead(canvas, re.drawPath[last - 1], re.drawPath[last], cs, arrowKey, re.edge.arrowTypeEnd, tgtBar, tgtOnFrame);
    }
    if (re.edge.hasArrowStart) {
      drawArrowHead(canvas, re.drawPath[1], re.drawPath[0], cs, arrowKey, re.edge.arrowTypeStart, srcBar, srcOnFrame);
    }
    const ruleStroke = edgeLineChars(re.edge.style, cs)[1];
    for (const [onRule, hasHead, at] of [
      [srcRule, re.edge.hasArrowStart, re.drawPath[0]],
      [tgtRule, re.edge.hasArrowEnd, re.drawPath[last]],
    ] as const) {
      if (!onRule || hasHead) continue;
      canvas.recast(at[1], at[0], ruleStroke);
      canvas.setStyle(at[1], at[0], key);
    }
    const twoWay = re.edge.hasArrowStart && re.edge.hasArrowEnd;
    const startMarked = twoWay && sides.has(borderSide(re.edge.source, re.startDir));
    const endMarked = twoWay && sides.has(borderSide(re.edge.target, re.endDir));
    const thick = re.edge.style === EdgeStyle.THICK;
    const srcPierced = pierceDrumHairline(canvas, graph, layout, re.edge.source, re.drawPath, 0, key, cs);
    const tgtPierced = pierceDrumHairline(canvas, graph, layout, re.edge.target, re.drawPath, last, key, cs);
    if (!srcBar && !srcPierced && walled(graph, re.edge.source, re.startDir) && !(re.edge.sourceIsSubgraph && tightFrame(layout, re.edge.source)))
      drawBoxStart(canvas, re.drawPath[0], re.drawPath[1], cs, re.edge.hasArrowStart, startMarked, thick);
    if (!tgtBar && !tgtPierced && walled(graph, re.edge.target, re.endDir) && !(re.edge.targetIsSubgraph && tightFrame(layout, re.edge.target)))
      drawBoxStart(canvas, re.drawPath[last], re.drawPath[last - 1], cs, re.edge.hasArrowEnd, endMarked, thick);
  }

  drawJoints(canvas, graph, routed);

  const placed: PlacedLabel[] = subgraphLabelSpans(layout);
  const firsts = new Map<string, number>();
  for (const re of routed) firsts.set(pairOf(re.edge), Math.min(firsts.get(pairOf(re.edge)) ?? re.index, re.index));
  const outer: LabelSeat = { ...seat, ownRight: false };
  const inner: LabelSeat = { ...seat, ownRight: true };
  const loops = new Map<string, number>();
  for (const re of routed) if (isSelfReference(re.edge)) loops.set(re.edge.source, (loops.get(re.edge.source) ?? 0) + 1);
  // Each run's cells. A label beside a run that is not its own would be read as naming it, save in a sheaf of labelled
  // links joining the same two boxes, where each stands above its own run and the order reads itself.
  const owners = new Map<string, RoutedEdge[]>();
  for (const re of routed) if (re.edge.style !== EdgeStyle.INVISIBLE) for (const cell of cellsOfPath(re.drawPath)) pushInto(owners, cell, re);
  const sheafed = (re: RoutedEdge, me: RoutedEdge): boolean => re.label !== "" && pairOf(re.edge) === pairOf(me.edge);
  const misreadBy =
    (me: RoutedEdge): Misread =>
    (cell) =>
      (owners.get(cell) ?? []).some((re) => re !== me && !sheafed(re, me));
  for (const re of routed) {
    if (re.label === "" || re.drawPath.length < 2) continue;
    const pair = pairOf(re.edge);
    const own = !layout.parallels.has(pair) ? seat : firsts.get(pair) === re.index ? outer : inner;
    drawEdgeLabel(canvas, re, placed, labelStyleKey(graph, re), own, foreignTo(re, layout), loops.get(re.edge.source) === 1, misreadBy(re));
  }
}

// A junction is the cell its runs land beside, one arm toward each: a real joint, so four arms meet on `┼`.
function drawJoints(canvas: Canvas, graph: Graph, routed: readonly RoutedEdge[]): void {
  const joints = new Map<string, { x: number; y: number; arms: Weight[]; key: string }>();
  for (const re of routed) {
    const path = re.drawPath;
    if (path.length < 2 || re.edge.style === EdgeStyle.INVISIBLE) continue;
    const weight = re.edge.style === EdgeStyle.THICK ? HEAVY : LIGHT;
    const ends: ReadonlyArray<readonly [string, readonly [number, number], readonly [number, number]]> = [
      [re.edge.source, path[0], path[1]],
      [re.edge.target, path[path.length - 1], path[path.length - 2]],
    ];
    for (const [id, end, next] of ends) {
      if (graph.nodes.get(id)?.shape !== NodeShape.JUNCTION) continue;
      const dx = Math.sign(end[0] - next[0]);
      const dy = Math.sign(end[1] - next[1]);
      const x = end[0] + dx;
      const y = end[1] + dy;
      const joint = joints.get(cellId(x, y)) ?? { x, y, arms: [NONE, NONE, NONE, NONE], key: edgeStyleKey(graph, re) };
      joint.arms[dx > 0 ? 0 : dx < 0 ? 1 : dy > 0 ? 2 : 3] = weight;
      joints.set(cellId(x, y), joint);
    }
  }
  for (const { x, y, arms, key } of joints.values()) {
    const [left, right, up, down] = arms;
    const glyph = weightedGlyph([left, right, up, down]);
    if (glyph !== undefined) canvas.put(y, x, glyph, false, key);
  }
}

function foreignTo(re: RoutedEdge, layout: GridLayout): Foreign {
  const path = re.drawPath;
  const [sx, sy] = path[0];
  const [tx, ty] = path[path.length - 1];
  const within = (sb: SubgraphBounds, row: number, col: number): boolean =>
    col > sb.x && col < sb.x + sb.width - 1 && row > sb.y && row < sb.y + sb.height - 1;
  const abroad = layout.subgraphBounds.filter((sb) => !(within(sb, sy, sx) && within(sb, ty, tx)));
  if (abroad.length === 0) return ON_THE_PAGE;
  return (row, col) => abroad.some((sb) => within(sb, row, col));
}
