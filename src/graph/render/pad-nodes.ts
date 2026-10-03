import { Canvas, DEFAULT_STYLE } from "../../canvas/canvas.js";
import { ARCS, armsOf } from "../../canvas/alphabet.js";
import { LIGHT, NONE, heaviest, weightedGlyph } from "../../canvas/arms.js";
import { type Graph } from "../model.js";
import { NodeShape } from "../shapes.js";
import { type CharSet } from "../../canvas/model.js";
import { edgesOfPlaced, type GridLayout } from "../layout/grid.js";
import { TightAxis } from "../layout/laid.js";
import { PADDED_SHAPES, nameMarks, padInnerLines, padNameMarks, INNER_LINES, unmarkRules } from "./tight.js";
import { PAD_CORNERS, PAD_ROUND_CORNERS, PAD_RULES } from "../../canvas/pad-glyphs.js";
import { SHEARED_SHAPES, padBraces, padDividedBand, padFlagNotch, padShearedFlats, padStadium } from "./tight-shapes.js";
import { retreatBorders, padSubroutine } from "./borders.js";
import { UNFILLED_SHAPES, nodeProps, nodeStyleKey } from "./nodes.js";
import { closeUpTight, tightenFrame, widenFrame } from "../../canvas/fit-frame.js";
import { SLAB_TAIL } from "../../canvas/keys.js";
import { PROP_STROKE_DASHARRAY } from "../../source/css.js";

import { BLANK_CELL, edgeKeyOutside, edgeStrokeOutside } from "../../canvas/cells.js";
import type { Edges } from "../../canvas/extent.js";

export function padNodeBorders(canvas: Canvas, graph: Graph, layout: GridLayout, cs: CharSet): void {
  for (const id of graph.nodeOrder) {
    const p = layout.placements.get(id);
    const node = graph.nodes.get(id);
    if (p === undefined || node === undefined || p.mark || !PADDED_SHAPES.has(node.shape)) continue;
    const props = nodeProps(graph, id, node.styleClasses);
    if (props !== undefined && props.has(PROP_STROKE_DASHARRAY)) continue;
    const edges = edgesOfPlaced(p);
    padNodeBorder(canvas, cs, node.shape, edges, nodeStyleKey(graph, id, node), layout.tightAxes.get(id));
  }
}

// One box's border moved onto the edge of its cells: on the form `axis` gives it where it has one, each shape's own
// pieces moved along with it where it has none.
export function padNodeBorder(canvas: Canvas, cs: CharSet, shape: NodeShape, { top, bottom, left, right }: Edges, key: string, axis: TightAxis | undefined): void {
  const rounded = shape === NodeShape.ROUNDED;
  if (axis !== undefined) {
    const marks = nameMarks(cs, shape);
    if (marks !== undefined) unmarkRules(canvas, top, bottom, left, right, marks[0]);
    if (axis === TightAxis.HORIZONTAL) {
      if (marks !== undefined) padNameMarks(canvas, top, bottom, left, right, key, marks[1], false);
      widenFrame(canvas, top, bottom, left, right, key, rounded);
      return;
    }
    const [boxTop, boxBottom] = closeUpTight(canvas, top, bottom, left, right);
    if (marks !== undefined) padNameMarks(canvas, boxTop, boxBottom, left, right, key, marks[1], true);
    tightenFrame(canvas, boxTop, boxBottom, left, right, key, rounded);
    return;
  }
  if (shape === NodeShape.STADIUM) {
    padStadium(canvas, top, bottom, left, right, key, `${key}${SLAB_TAIL}`);
    return;
  }
  const inner = INNER_LINES.get(shape);
  if (inner !== undefined) padInnerLines(canvas, top, bottom, left, right, key, inner);
  if (SHEARED_SHAPES.has(shape)) padShearedFlats(canvas, cs, top, bottom, left, right, key);
  if (UNFILLED_SHAPES.has(shape)) padBraces(canvas, cs, top, bottom, left, right);
  if (shape === NodeShape.DIVIDED_RECTANGLE) padDividedBand(canvas, top, bottom, left, right, key);
  if (shape === NodeShape.ASYMMETRIC) padFlagNotch(canvas, cs, top, bottom, left);
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (r !== top && r !== bottom && c !== left && c !== right) continue;
      const ch = canvas.get(r, c);
      if (ch === BLANK_CELL || canvas.isText(r, c)) continue;
      const straight = armsOf(ch);
      const isRule =
        straight !== undefined &&
        ((straight[0] === straight[1] && straight[2] === NONE && straight[3] === NONE) ||
          (straight[2] === straight[3] && straight[0] === NONE && straight[1] === NONE));
      const corner = (r === top || r === bottom) && (c === left || c === right) && !isRule;
      if (corner) {
        const weight = ARCS.has(ch) ? LIGHT : heaviest(armsOf(ch) ?? [NONE]);
        const corners = PAD_CORNERS.get(weight);
        if (weight === NONE || corners === undefined) continue;
        const at = (r === top ? 0 : 2) + (c === left ? 0 : 1);
        const glyph = rounded ? PAD_ROUND_CORNERS[at] : (corners[at]);
        canvas.recast(r, c, glyph);
        if (glyph === BLANK_CELL) canvas.setStyle(r, c, DEFAULT_STYLE);
        continue;
      }
      const arms = armsOf(ch);
      if (arms === undefined) continue;
      const [l, rt, u, d] = arms;
      const stub = r === top ? u : r === bottom ? d : c === left ? l : rt;
      if (stub !== NONE) {
        const stroke = r === top || r === bottom ? weightedGlyph([NONE, NONE, stub, stub]) : weightedGlyph([stub, stub, NONE, NONE]);
        if (stroke === undefined) continue;
        canvas.recast(r, c, edgeStrokeOutside(canvas, r, c, top, bottom, left, right, stroke));
        canvas.setStyle(r, c, edgeKeyOutside(canvas, r, c, top, bottom, left, right));
        continue;
      }
      const along = r === top || r === bottom ? [l, rt] : [u, d];
      const across = r === top || r === bottom ? [u, d] : [l, rt];
      if (along[0] !== along[1] || across[0] !== NONE || across[1] !== NONE) continue;
      const rules = PAD_RULES.get(along[0]);
      if (rules === undefined) continue;
      canvas.recast(r, c, r === top ? rules[0] : r === bottom ? rules[1] : c === left ? rules[2] : rules[3]);
    }
  }
  if (shape === NodeShape.SUBROUTINE) padSubroutine(canvas, top, bottom, left, right, key);
  retreatBorders(canvas, top, bottom, left, right, key, shape, rounded);
}
