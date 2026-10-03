import { type Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { type FrameBox } from "../../canvas/frame-style.js";
import { SLAB_TAIL, SUBGRAPH } from "../../canvas/keys.js";
import { asksFill } from "../../source/css.js";
import { NodeShape } from "../../graph/shapes.js";
import { dropNodeBorder } from "../../graph/render/nodes.js";
import { asksBorder, slabOutline } from "../../graph/render/slabs.js";
import { edgesOf } from "../../canvas/extent.js";

export interface SlabbedBox extends FrameBox {
  readonly key: string;
  readonly props: ReadonlyMap<string, string> | undefined;
}

const within = (inner: FrameBox, outer: FrameBox): boolean =>
  inner !== outer && inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

// borderless as the graph engine lays it: a box that asks no stroke nor fill becomes a slab of its own ground, and so
// does an outermost frame, a nested one keeping its lines as a nested subgraph's (`dropNodeBorders`, `dropSubgraphBorders`).
export function slabBorders(canvas: Canvas, cs: CharSet, boxes: readonly SlabbedBox[], frames: readonly FrameBox[]): void {
  for (const box of boxes) {
    if (!asksBorder(box.props) && !asksFill(box.props)) dropNodeBorder(canvas, cs, NodeShape.RECTANGLE, edgesOf(box), box.key);
  }
  const slab = `${SUBGRAPH}${SLAB_TAIL}`;
  for (const frame of frames) {
    if (!frames.some((outer) => within(frame, outer))) slabOutline(canvas, edgesOf(frame), slab, (r, c) => canvas.getStyle(r, c) === SUBGRAPH);
  }
}
