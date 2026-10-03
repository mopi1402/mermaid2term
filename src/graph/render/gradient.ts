import { type Canvas } from "../../canvas/canvas.js";
import { COMPOSITE_FRAME, SUBGRAPH } from "../../canvas/keys.js";
import { bySize, markInOrder, type StrokedBox } from "../../canvas/gradient.js";
import { type Graph } from "../model.js";
import { NodeShape, BRACE_SHAPES } from "../shapes.js";
import { type GridLayout } from "../layout/grid.js";
import { nodeStyleKey, STATE_MARK_KEYS } from "./nodes.js";
import { nameMarks } from "./tight.js";
import { type CharSet } from "../../canvas/model.js";

// A brace is one stroke per side with nothing between them: a gradient across the box leaves the two halves of one
// sign in two colours, the far one faint on some grounds. It takes the gradient's first step whole instead.

// mermaid's `neo` look strokes every node and every cluster with one gradient laid over its own box.
export function markGradients(canvas: Canvas, graph: Graph, layout: GridLayout, cs: CharSet): void {
  // The smallest frame first: a nested one is marked before the frame around it reaches its cells, and a marked cell
  // is no longer a bare stroke to mark again. The whole box is read, a composite's title rule standing inside it.
  const frames = bySize(layout.subgraphBounds).map((bounds): StrokedBox => ({ ...bounds, owners: [SUBGRAPH, COMPOSITE_FRAME] }));
  const nodes: StrokedBox[] = [];
  for (const id of graph.nodeOrder) {
    const p = layout.placements.get(id);
    const node = graph.nodes.get(id);
    // A note is not a node mermaid's look strokes, and a state's start dot, end disc or fork bar is a fill.
    if (p === undefined || node === undefined || node.shape === NodeShape.NOTE || STATE_MARK_KEYS.has(node.shape)) continue;
    // A cylinder's rim can stand on the row just past its box, above or below: it is still the node's stroke.
    const rim = node.shape === NodeShape.CYLINDER ? 1 : 0;
    nodes.push({
      x: p.drawX,
      y: p.drawY - rim,
      width: p.drawWidth,
      height: p.drawHeight + 2 * rim,
      owners: [nodeStyleKey(graph, id, node)],
      // The mark that names a circle or a rhombus drawn as a box is a sign, not a stretch of the stroke: a step of
      // the gradient on one glyph reads as a colour of its own, too faint on some grounds, so it keeps the border's ink.
      kept: nameMarks(cs, node.shape) ?? [],
      // Each cell of a brace is a box of its own one column wide, so each takes the first step: see `docs/divergences.md`.
      perCell: BRACE_SHAPES.has(node.shape),
    });
  }
  markInOrder(canvas, [...frames, ...nodes]);
}
