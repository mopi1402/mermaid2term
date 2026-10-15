import type { Canvas } from "../../canvas/canvas.js";
import type { CharSet } from "../../canvas/model.js";
import type { Edges } from "../../canvas/extent.js";
import { EDGE, NODE, SUBGRAPH } from "../../canvas/keys.js";
import { ACROSS_STROKES, armsOf } from "../../canvas/alphabet.js";
import { NONE } from "../../canvas/arms.js";
import { cornersOf } from "../../canvas/corners.js";
import { headOutside, onAnEdge } from "../../canvas/cells.js";
import { OWN_KEY, widenFrame } from "../../canvas/fit-frame.js";
import { PROP_STROKE_DASHARRAY, asksFill } from "../../source/css.js";
import { type BorderMode } from "../../source/config.js";
import { EdgeStyle } from "../../graph/model.js";
import { TightAxis } from "../../graph/layout/laid.js";
import { TIGHT_SHAPES } from "../../graph/layout/padless.js";
import { PADDED_SHAPES } from "../../graph/render/tight.js";
import { padNodeBorder } from "../../graph/render/pad-nodes.js";
import { UNFILLED_SHAPES, dropNodeBorder } from "../../graph/render/nodes.js";
import { asksBorder } from "../../graph/render/slabs.js";
import type { Block } from "./model.js";
import type { Drawn } from "./draw.js";
import { sizeOf, type Placed, type Sized } from "./metrics.js";

const [LEFT_ARM, RIGHT_ARM, UP_ARM, DOWN_ARM] = [0, 1, 2, 3];

// A block's outline in the border mode asked, drawn as a flowchart node of its shape is: `filled` says a theme lays
// the blocks' ground, which a slab needs to show the block at all.
export interface BlockBorders {
  readonly borders: BorderMode;
  readonly filled: boolean;
  readonly cs: CharSet;
  readonly rounded: boolean;
  // How many of a block's links meet a wall and how many a rule, the tally a graph node takes its padless form by.
  readonly walls: ReadonlyMap<string, number>;
  readonly rules: ReadonlyMap<string, number>;
}

export function blockBorders(borders: BorderMode, filled: boolean, cs: CharSet, rounded: boolean, links: readonly Drawn[]): BlockBorders {
  const walls = new Map<string, number>();
  const rules = new Map<string, number>();
  for (const { link, route } of links) {
    if (link.style === EdgeStyle.INVISIBLE) continue;
    for (const [id, [dx]] of [[link.source, route.startHead], [link.target, route.endHead]] as const) {
      const tally = dx === 0 ? rules : walls;
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
  }
  return { borders, filled, cs, rounded, walls, rules };
}

// Between the outline's weight and its inks, as a graph node is moved between its restyle and its paint.
export function reborderBlock(canvas: Canvas, block: Block, edges: Edges, props: ReadonlyMap<string, string> | undefined, mode: BlockBorders): void {
  const { borders, cs } = mode;
  if (borders === "padless") {
    if (!PADDED_SHAPES.has(block.shape) || props?.has(PROP_STROKE_DASHARRAY) === true) return;
    const walls = mode.walls.get(block.id) ?? 0;
    const rules = mode.rules.get(block.id) ?? 0;
    const axis = TIGHT_SHAPES.has(block.shape) ? (walls > rules ? TightAxis.HORIZONTAL : TightAxis.VERTICAL) : undefined;
    if (axis === TightAxis.VERTICAL) flushHeads(canvas, mode, edges);
    padNodeBorder(canvas, cs, block.shape, edges, NODE, axis);
    return;
  }
  if (borders !== "borderless" || !mode.filled || UNFILLED_SHAPES.has(block.shape) || asksBorder(props) || asksFill(props)) return;
  dropNodeBorder(canvas, cs, block.shape, edges, NODE);
}

// A head beside a wall that moves onto the inner edge of its cell would stop a whole cell short of the ink: it takes
// the wall's cell, as a graph edge's head does under padless, the wall steps inside it, and the cell it leaves joins
// the link to it, straight on or turning as the link came.
function flushHeads(canvas: Canvas, mode: BlockBorders, { top, bottom, left, right }: Edges): void {
  const { cs } = mode;
  const [topLeft, topRight, bottomLeft, bottomRight] = cornersOf(cs, mode.rounded);
  const reaches = (r: number, c: number, arm: number): boolean => (armsOf(canvas.get(r, c))?.[arm] ?? NONE) !== NONE && onAnEdge(canvas.getStyle(r, c));
  for (let r = top + 1; r < bottom; r++) {
    for (const [wall, step, toward] of [[left, -1, cs.arrowRight], [right, 1, cs.arrowLeft]] as const) {
      const at = wall + step;
      if (canvas.get(r, at) !== toward || !headOutside(canvas, r, at)) continue;
      const beyond = at + step;
      const [fed, joint] = reaches(r, beyond, step < 0 ? RIGHT_ARM : LEFT_ARM)
        ? [[r, beyond] as const, ACROSS_STROKES.has(canvas.get(r, beyond)) ? canvas.get(r, beyond) : cs.horizontal]
        : reaches(r - 1, at, DOWN_ARM)
          ? [[r - 1, at] as const, step < 0 ? bottomLeft : bottomRight]
          : reaches(r + 1, at, UP_ARM)
            ? [[r + 1, at] as const, step < 0 ? topLeft : topRight]
            : [undefined, cs.horizontal];
      canvas.recast(r, wall, toward);
      canvas.setStyle(r, wall, canvas.getStyle(r, at));
      canvas.recast(r, at, joint);
      canvas.setStyle(r, at, fed === undefined ? EDGE : canvas.getStyle(fed[0], fed[1]));
    }
  }
}

// A composite's frame under padless, drawn as an unlinked subgraph's across the flow: its walls on the outer edge of
// their cells, its rules on the inner edge. It keeps its own key, a block's frame laying no ground of its own.

export function padGroups(canvas: Canvas, blocks: readonly Block[], positions: Placed, sizes: Sized): void {
  for (const block of blocks) {
    if (block.children.length === 0) continue;
    const at = positions.get(block.id);
    if (at !== undefined) {
      const [w, h] = sizeOf(sizes, block.id);
      widenFrame(canvas, at[1], at[1] + h - 1, at[0], at[0] + w - 1, SUBGRAPH, false, OWN_KEY);
    }
    padGroups(canvas, block.children, positions, sizes);
  }
}
