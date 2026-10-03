import { Canvas, DEFAULT_STYLE } from "../../canvas/canvas.js";
import { ARCS, stubOf } from "../../canvas/alphabet.js";
import { type Graph, type Node, nodeClassProps, nodeProps, wornClass } from "../model.js";

export { nodeProps };
import { NodeShape, BRACE_SHAPES } from "../shapes.js";
import { type CharSet } from "../../canvas/model.js";
import { edgesOfPlaced, midCol, midRow, type GridLayout } from "../layout/grid.js";
import { type NodePlacement } from "../layout/laid.js";
import { BLANK_CELL, edgeLeavesThrough } from "../../canvas/cells.js";
import { SLANTED_SHAPES, facingInside, slabRing, asksBorder, slabCard, slabFlag, slabSlope } from "./slabs.js";
import { pillBorders } from "./tight-shapes.js";
import { groundedBorders } from "./tight.js";
import { SHAPE_RENDERERS } from "./shapes.js";
import { asksFill, CLASS_DEFAULT, PROP_FILL } from "../../source/css.js";
import { CLASS_PREFIX, LABEL as STYLE_LABEL, inkRuns, NODE, NODE_STYLE_PREFIX, NOTE as STYLE_NOTE, NOTE_FILL, NOTE_LABEL, NOTE_RIM, NOTCH_TAIL, FOLD_TAIL, SLAB_TAIL, STATE_END, STATE_SPECIAL } from "../../canvas/keys.js";
import { restyleBox } from "../../canvas/strokes.js";
import { fadeBox } from "../../canvas/frame-style.js";
import { boxCells, type Edges } from "../../canvas/extent.js";

import { centredAt } from "../../text/width.js";
import { drumExtent } from "../layout/padless.js";
import { fillInterior } from "../../canvas/shape-frame.js";
import { drawDrum } from "./drums.js";


// Each node the layout placed, in the source's order.
function* placedNodes(graph: Graph, layout: GridLayout): Generator<{ readonly id: string; readonly p: NodePlacement; readonly node: Node }> {
  for (const id of graph.nodeOrder) {
    const p = layout.placements.get(id);
    const node = graph.nodes.get(id);
    if (p !== undefined && node !== undefined) yield { id, p, node };
  }
}

export function restyleBorders(canvas: Canvas, graph: Graph, layout: GridLayout, cs: CharSet): void {
  for (const { id, p, node } of placedNodes(graph, layout)) {
    const props = nodeProps(graph, id, node.styleClasses);
    if (props === undefined) continue;
    restyleBox(canvas, p.drawY, p.drawX, p.drawHeight, p.drawWidth, props, cs);
  }
}

// Each node's opacities, laid once its border mode has moved the walls: a wall recast after its fade would show its
// ink and its ground whole.
export function fadeNodes(canvas: Canvas, graph: Graph, layout: GridLayout): void {
  for (const { id, p, node } of placedNodes(graph, layout)) {
    const props = nodeProps(graph, id, node.styleClasses);
    if (props === undefined) continue;
    fadeBox(canvas, { x: p.drawX, y: p.drawY, w: p.drawWidth, h: p.drawHeight }, props, nodeClassProps(graph, node.styleClasses));
  }
}

export const STATE_MARK_KEYS: ReadonlyMap<NodeShape, string> = new Map([
  [NodeShape.START_STATE, STATE_SPECIAL],
  [NodeShape.FORK_JOIN, STATE_SPECIAL],
  [NodeShape.END_STATE, STATE_END],
]);

export function nodeStyleKey(graph: Graph, id: string, node: Node): string {
  if (node.shape === NodeShape.NOTE) return STYLE_NOTE;
  const mark = STATE_MARK_KEYS.get(node.shape);
  if (mark !== undefined) return mark;
  if (graph.nodeStyles.has(id)) return NODE_STYLE_PREFIX + id;
  const worn = wornClass(graph, node.styleClasses);
  if (worn !== undefined) return CLASS_PREFIX + worn;
  if (graph.classDefs.has(CLASS_DEFAULT)) return CLASS_PREFIX + CLASS_DEFAULT;
  return NODE;
}

export function dropNodeBorders(canvas: Canvas, graph: Graph, layout: GridLayout, cs: CharSet, themeFills: boolean): void {
  for (const { id, p, node } of placedNodes(graph, layout)) {
    if (p.mark || UNFILLED_SHAPES.has(node.shape)) continue;
    const props = nodeProps(graph, id, node.styleClasses);
    if (asksBorder(props) || asksFill(props)) continue;
    const style = nodeStyleKey(graph, id, node);
    if (style !== STYLE_NOTE && !themeFills) continue;
    dropNodeBorder(canvas, cs, node.shape, edgesOfPlaced(p), style);
  }
}

// One box laid as a slab of its own ground, the half of each outline cell facing inside kept, a link's stub let through.
export function dropNodeBorder(canvas: Canvas, cs: CharSet, shape: NodeShape, edges: Edges, style: string): void {
  const { top, bottom, left, right } = edges;
  const fill = style === STYLE_NOTE ? NOTE_FILL : `${style}@${PROP_FILL}`;
  const slab = `${style}${SLAB_TAIL}`;
  if (shape === NodeShape.STADIUM) {
    pillBorders(canvas, top, bottom, left, right, slab);
    return;
  }
  if (shape === NodeShape.ASYMMETRIC) {
    slabFlag(canvas, cs, top, bottom, left, right, slab, `${style}${NOTCH_TAIL}`);
    return;
  }
  if (shape === NodeShape.NOTCHED_RECTANGLE) {
    slabCard(canvas, top, bottom, left, right, slab, fill);
    return;
  }
  const settle = (r: number, c: number, ch: string): boolean => {
    if (ARCS.has(ch)) {
      canvas.recast(r, c, BLANK_CELL);
      canvas.setStyle(r, c, DEFAULT_STYLE);
      return true;
    }
    const slope = slabSlope(cs, ch);
    if (slope !== undefined) {
      canvas.recast(r, c, c - left < right - c ? slope[0] : slope[1]);
      canvas.setStyle(r, c, slab);
      return true;
    }
    if (SLANTED_SHAPES.has(shape)) {
      if (ch === cs.hexPointLeft || ch === cs.hexPointRight) {
        canvas.recast(r, c, ch === cs.hexPointLeft ? cs.hexTipLeft : cs.hexTipRight);
        canvas.setStyle(r, c, slab);
        return true;
      }
      const shared = (r === top && ch === cs.ruleCeiling) || (r === bottom && ch === cs.ruleFloor);
      const own = (r === top && ch === cs.ruleFloor) || (r === bottom && ch === cs.ruleCeiling);
      if (shared || own) {
        const before = canvas.getStyle(r, c - 1);
        const first = own && canvas.get(r, c - 1) !== ch && before !== slab && before !== fill;
        const last = own && canvas.get(r, c + 1) !== ch;
        const end = first ? (r === top ? "◢" : "◥") : last ? (r === top ? "◣" : "◤") : undefined;
        canvas.recast(r, c, end ?? BLANK_CELL);
        canvas.setStyle(r, c, end === undefined ? fill : slab);
        return true;
      }
    }
    return edgeLeavesThrough(canvas, r, c, top, bottom, left, right);
  };
  const facing = facingInside(edges);
  slabRing(canvas, boxCells(edges), {
    slabOf: (r, c, ch) => (ch === BLANK_CELL || canvas.isText(r, c) ? undefined : slab),
    settle,
    half: (r, c, ch) => (stubOf(ch) === undefined ? undefined : (facing.down(r, c) ?? facing.across(r, c))),
    ...facing,
  });
}

export const UNFILLED_SHAPES = new Set([...BRACE_SHAPES, NodeShape.TEXT]);

// A note's frame stands ON the note's own ground, never on the page: mermaid strokes a rect it has already filled,
// so no page shows between the fill and the line drawn around it. Run AFTER the edges, or the tether cut into a
// wall would take its cell back. The class diagram draws its notes this way already, and so does a padless box.
export function groundNoteFrames(canvas: Canvas, graph: Graph, layout: GridLayout): void {
  for (const { id, p, node } of placedNodes(graph, layout)) {
    if (node.shape !== NodeShape.NOTE) continue;
    const bottom = p.drawY + p.drawHeight - 1;
    const right = p.drawX + p.drawWidth - 1;
    const kept = groundedBorders(layout.tightAxes.get(id));
    for (let r = p.drawY; r <= bottom; r++) {
      for (let c = p.drawX; c <= right; c++) {
        const onRule = r === p.drawY || r === bottom;
        const onWall = c === p.drawX || c === right;
        if (!onRule && !onWall) continue;
        if (!(onRule && onWall ? kept.corners : onRule ? kept.rules : kept.walls)) continue;
        canvas.setStyle(r, c, canvas.get(r, c) === BLANK_CELL ? NOTE_FILL : NOTE_RIM);
      }
    }
  }
}

export function drawNodes(canvas: Canvas, graph: Graph, layout: GridLayout, cs: CharSet): void {
  for (const { id, p, node } of placedNodes(graph, layout)) {

    const style = nodeStyleKey(graph, id, node);
    const isNote = style === STYLE_NOTE;
    const unfilled = UNFILLED_SHAPES.has(node.shape);

    const labelKey = isNote ? NOTE_LABEL : unfilled ? STYLE_LABEL : `${style}@${STYLE_LABEL}`;
    const seat = node.shape === NodeShape.CYLINDER ? layout.drums.get(id) : undefined;
    let fillY = p.drawY;
    let fillRows = p.drawHeight;
    if (seat !== undefined) {
      drawDrum(canvas, p.drawX, p.drawY, p.drawWidth, p.drawHeight, layout.labelOf(node), cs, style, labelKey, seat);
      ({ top: fillY, rows: fillRows } = drumExtent(seat, p.drawY, p.drawHeight));
    } else {
      const renderer = SHAPE_RENDERERS.get(node.shape) ?? SHAPE_RENDERERS.get(NodeShape.RECTANGLE);
      renderer?.(canvas, p.drawX, p.drawY, p.drawWidth, p.drawHeight, layout.labelOf(node), cs, style, labelKey);
    }
    const fold = `${style}${FOLD_TAIL}`;
    const onGround = (r: number, c: number): boolean => canvas.getStyle(r, c) === fold;
    if (!unfilled) fillInterior(canvas, p.drawX, fillY, p.drawWidth, fillRows, isNote ? NOTE_FILL : `${style}@${PROP_FILL}`, onGround);

    // BEFORE the cells are protected: a protected cell turns `put` back before it writes the style, and the
    // segments would leave the label exactly as the theme painted it. Row and column are `drawLabel`'s own, so
    // the ink lands on the letters it already wrote, and a label the layout had to wrap is left alone.
    if (node.labelSegments !== undefined && node.labelSegments.length > 0) {
      const spelled = node.labelSegments.map((seg) => seg.text).join("");
      if (spelled === layout.labelOf(node)) {
        canvas.putStyledText(
          p.drawY + Math.floor((p.drawHeight - 1) / 2),
          p.drawX + centredAt(p.drawWidth, spelled),
          inkRuns(node.labelSegments, isNote ? "" : `${style}@`)
        );
      }
    }

    if (p.mark) canvas.protect(midRow(p), midCol(p));
    else for (const [r, c] of boxCells(edgesOfPlaced(p))) canvas.protect(r, c);

    if (node.link !== undefined) canvas.linkLabel(p.drawY, p.drawX, p.drawWidth, p.drawHeight, node.link);
  }
}
