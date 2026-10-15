import type { Canvas } from "../../canvas/canvas.js";
import { layBand } from "../../canvas/band.js";
import { fillCluster } from "../../canvas/cluster.js";
import { fadeBox, fillHex, inkBox, inkRing, type FrameBox } from "../../canvas/frame-style.js";
import { restyleBox } from "../../canvas/strokes.js";
import { edgesOf } from "../../canvas/extent.js";
import { reborderBlock, type BlockBorders } from "./borders.js";
import { LABEL, MARK_TAIL, NODE as THEME_FILL, RIM_TAIL, SUBGRAPH } from "../../canvas/keys.js";
import { baseKey, inkOff } from "../../paint/mix.js";
import { colourToHex } from "../../colour/colours.js";
import { floodInterior } from "../../canvas/shape-frame.js";
import { PROP_STROKE, wornProps } from "../../source/css.js";
import { slotted, type ColorSlots } from "../../paint/color-slots.js";
import type { Block, BlockDiagram } from "./model.js";
import { sizeOf, type Placed, type Sized } from "./metrics.js";

const SIDES: ReadonlyArray<readonly [number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// What a block's `classDef`, `class` and `style` ask of it, laid as a class box's are: the outline's dashes, weight
// and ink, the label's colour and font, and the fill inside the outline, whatever its shape; with no fill written,
// the theme's `mainBkg`, as mermaid fills every block.
// The border mode moves each outline between its weight and its inks.
export function styleBlocks(canvas: Canvas, diagram: BlockDiagram, blocks: readonly Block[], positions: Placed, sizes: Sized, mode: BlockBorders): void {
  const { cs } = mode;
  for (const block of blocks) {
    if (block.children.length > 0) styleBlocks(canvas, diagram, block.children, positions, sizes, mode);
    const at = positions.get(block.id);
    if (block.isSpace || block.children.length > 0 || at === undefined) continue;
    const props = wornProps(diagram.classDefs, diagram.classes.get(block.id) ?? [], diagram.styles.get(block.id));
    const [x, y] = at;
    const [w, h] = sizeOf(sizes, block.id);
    const box = { x, y, w, h };
    if (props !== undefined) restyleBox(canvas, y, x, h, w, props, cs);
    reborderBlock(canvas, block, edgesOf(box), props, mode);
    // Faded once the border mode has moved the walls, which a recast would otherwise show whole.
    if (props !== undefined) fadeBox(canvas, box, props, wornProps(diagram.classDefs, diagram.classes.get(block.id) ?? [], undefined));
    if (props !== undefined) inkBox(canvas, box, props, cs, (key) => key.startsWith(LABEL));
    const fill = fillHex(props) ?? THEME_FILL;
    // A wall drawn on one edge of its cell holds the rest of that cell inside the block: it takes the fill too.
    const bare = (r: number, c: number): string => inkOff(baseKey(canvas.getStyle(r, c)))[0];
    const onFill = (r: number, c: number): boolean => bare(r, c).endsWith(RIM_TAIL);
    // Moved by the border mode, a sign standing on the fill is crossed on the way, and every piece of the outline
    // inked on its outer edge stands on the fill, as a graph node's rim does.
    const moved = mode.borders !== "default";
    floodInterior(canvas, x, y, w, h, (r, c) => {
      layBand(canvas, r, r, c, c, fill);
      for (const [dr, dc] of SIDES) if (onFill(r + dr, c + dc)) layBand(canvas, r + dr, r + dr, c + dc, c + dc, fill);
    }, moved ? (r, c) => bare(r, c).endsWith(MARK_TAIL) : undefined, moved ? labelCell(canvas, box) : undefined);
    if (moved) for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) if (onFill(r, c)) layBand(canvas, r, r, c, c, fill);
  }
}

// A colour theme's slot for each composite, counted parents first as mermaid's `colorIndex`: its frame in the slot's
// stroke, an edge crossing it kept in its own ink, and its inside on the slot's fill, which the blocks it holds cover.
// Every frame is inked before any ground is laid, a nested frame standing on its parent's.
// Under padless the walls ride the outer edge of their cells, on the frame's ground, so the fill reaches them.
export function dressComposites(canvas: Canvas, blocks: readonly Block[], positions: Placed, sizes: Sized, colorSlots: ColorSlots | undefined, padless: boolean): void {
  if (colorSlots === undefined) return;
  const dressed = compositesOf(blocks).flatMap((block, slot) => {
    const at = positions.get(block.id);
    const props = slotted(colorSlots, slot, undefined);
    if (at === undefined || props === undefined) return [];
    const [w, h] = sizeOf(sizes, block.id);
    return [{ box: { x: at[0], y: at[1], w, h }, props }];
  });
  for (const { box, props } of dressed) inkRing(canvas, box, colourToHex(props.get(PROP_STROKE) ?? ""), (key) => key === SUBGRAPH);
  const walls = padless ? 0 : 1;
  for (const { box: { x, y, w, h }, props } of dressed) {
    const fill = fillHex(props);
    if (fill !== undefined) layBand(canvas, y + 1, y + h - 2, x + walls, x + w - 1 - walls, fill);
  }
}

// Every composite, parents first.
function compositesOf(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((block) => (block.children.length === 0 ? [] : [block, ...compositesOf(block.children)]));
}

// mermaid's `.node .cluster` lays `clusterBkg` inside every composite, behind the blocks it holds; under padless the
// walls ride the outer edge of their cells, so the ground reaches them.
export function groundComposites(canvas: Canvas, blocks: readonly Block[], positions: Placed, sizes: Sized, padless: boolean): void {
  for (const block of compositesOf(blocks)) {
    const at = positions.get(block.id);
    if (at === undefined) continue;
    const [w, h] = sizeOf(sizes, block.id);
    fillCluster(canvas, at[0], at[1], w, h, padless ? 0 : 1);
  }
}

// The first cell of a block's name: the outline a border mode closes on the name holds it wherever the rules went.
function labelCell(canvas: Canvas, { x, y, w, h }: FrameBox): readonly [number, number] | undefined {
  for (let r = y + 1; r < y + h - 1; r++) for (let c = x + 1; c < x + w - 1; c++) if (canvas.isText(r, c)) return [r, c];
  return undefined;
}
