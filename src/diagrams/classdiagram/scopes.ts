import type { ClassDiagram, Namespace, Relationship, Frame, Layout } from "./model.js";
import { widestLabelLine } from "../../text/labels.js";
import { displayWidth } from "../../text/width.js";
import { must } from "../../must.js";
import { boxSize } from "./class-box.js";
import { BLOCK_PREFIX, BT, KEY_SEP, LAYER_STRIDE, MARGIN, SELF_ARM } from "./metrics.js";
import { isHorizontal } from "../../graph/model.js";
import { layoutItems } from "./items.js";
import { mergeShifted } from "./packing.js";
import { nestRoom, nestedLoops } from "./nests.js";

const FRAME_SIDE = 1;

const FRAME_HEAD = 2;

const FRAME_FOOT = 1;

export const held = (ns: Namespace): string[] => [...ns.classes, ...ns.children.flatMap(held)];

export function layoutScope(
  diagram: ClassDiagram,
  classes: string[],
  namespaces: Namespace[],
  paddingX: number,
  gap: number,
  scopeKey: { next: number },
  hideEmpty: boolean,
  airyLabels: boolean
): Layout {
  const isLR = isHorizontal(diagram.direction);
  const sizes = new Map<string, [number, number]>();
  for (const name of classes) sizes.set(name, boxSize(must(diagram.classes.get(name)), paddingX, hideEmpty));

  const blockOf = new Map<string, string>();
  const blocks = new Map<string, { layout: Layout; ns: Namespace }>();
  namespaces.forEach((ns, index) => {
    const id = `${BLOCK_PREFIX}${scopeKey.next}${KEY_SEP}${index}`;
    const layout = layoutScope(diagram, ns.classes, ns.children, paddingX, gap, scopeKey, hideEmpty, airyLabels);
    blocks.set(id, { layout, ns });
    for (const name of held(ns)) blockOf.set(name, id);
    const width = Math.max(layout.width - (MARGIN - 1) * 2 + FRAME_SIDE * 2, displayWidth(ns.label) + 2 + FRAME_SIDE * 2);
    sizes.set(id, [besideStems(diagram, ns, layout, width), layout.height - (MARGIN - 1) * 2 + FRAME_HEAD + FRAME_FOOT]);
  });

  const owner = (name: string): string | undefined => (classes.includes(name) ? name : blockOf.get(name));
  const lifted: Relationship[] = [];
  for (const rel of diagram.relationships) {
    const source = owner(rel.source);
    const target = owner(rel.target);
    if (source === undefined || target === undefined || source === target) continue;
    lifted.push({ ...rel, source, target });
  }

  // A self relation loops OUTSIDE the box it leaves and comes back to, so the columns it rides and the label beside
  // it are reserved here: the box keeps its own width and the room is taken out of the gap on its right.
  const roomed = new Map(sizes);
  const stems = new Map<string, number>();
  const nests = nestedLoops(diagram.relationships);
  // Nesting, the loops also ride rows past the lid: the box stands at the foot of its room, laid upward at its top.
  const lids = new Map<string, number>();
  for (const rel of diagram.relationships) {
    if (rel.source !== rel.target) continue;
    const size = roomed.get(rel.source);
    if (size === undefined) continue;
    const [sw, sh] = must(sizes.get(rel.source));
    const nest = nests.get(rel.source);
    const [room, rows] = nest === undefined ? [SELF_ARM + (rel.label === "" ? 0 : widestLabelLine(rel.label) + 1), 0] : nestRoom(nest);
    roomed.set(rel.source, [Math.max(size[0], sw + room), sh + rows]);
    lids.set(rel.source, rows);
    if (!isLR) stems.set(rel.source, Math.floor(sw / 2));
    else if (rows > 0) stems.set(rel.source, rows + Math.floor(sh / 2));
  }

  const items = [...classes, ...blocks.keys()];
  const laid = layoutItems(items, roomed, lifted, isLR, gap, airyLabels, stems);
  const layerBase = scopeKey.next;
  scopeKey.next += 1;

  const positions = new Map<string, [number, number]>();
  const layerOf = new Map<string, number>();
  const frames: Frame[] = [];
  for (const name of classes) {
    positions.set(name, must(laid.positions.get(name)));
    layerOf.set(name, layerBase * LAYER_STRIDE + (laid.layerOf.get(name) ?? 0));
  }
  const loops = new Map<string, number>();
  for (const rel of diagram.relationships) {
    const at = positions.get(rel.source);
    if (rel.source !== rel.target || at === undefined || loops.has(rel.source)) continue;
    const side = loopSide(rel.source, lifted, laid, isLR);
    loops.set(rel.source, side);
    // Looping left, the box stands at the far end of its room so the loop keeps the columns reserved for it.
    const dx = side < 0 ? must(roomed.get(rel.source))[0] - must(sizes.get(rel.source))[0] : 0;
    positions.set(rel.source, [at[0] + dx, at[1] + (lids.get(rel.source) ?? 0)]);
  }
  for (const [id, { layout, ns }] of blocks) {
    const [bx, by] = must(laid.positions.get(id));
    const [bw, bh] = must(sizes.get(id));
    frames.push({ x: bx, y: by, width: bw, height: bh, label: ns.label });
    const dx = bx + FRAME_SIDE - (MARGIN - 1) + Math.floor((bw - FRAME_SIDE * 2 - layout.width + (MARGIN - 1) * 2) / 2);
    // Laid out upward, the lid is at the foot until `mirrored` flips it back on top.
    const dy = by + (diagram.direction === BT ? FRAME_FOOT : FRAME_HEAD) - (MARGIN - 1);
    mergeShifted({ positions, sizes, layerOf, frames, loops }, layout, dx, dy);
  }
  for (const id of blocks.keys()) sizes.delete(id);
  return { positions, sizes, width: laid.width, height: laid.height, layerOf, frames, loops };
}

// A self relation loops out of the right wall unless another relation meets that wall and none meets the left one.
function loopSide(name: string, relations: readonly Relationship[], laid: Layout, isLR: boolean): number {
  const midOf = (item: string): number => (laid.positions.get(item)?.[0] ?? 0) + Math.floor((laid.sizes.get(item)?.[0] ?? 0) / 2);
  const flanks = new Set<number>();
  for (const rel of relations) {
    if (rel.source === rel.target || (rel.source !== name && rel.target !== name)) continue;
    const partner = rel.source === name ? rel.target : rel.source;
    const sameLayer = laid.layerOf.get(partner) === laid.layerOf.get(name);
    if (isLR === sameLayer) continue;
    flanks.add(Math.sign(midOf(partner) - midOf(name)));
  }
  return flanks.has(1) && !flanks.has(-1) ? -1 : 1;
}

// Where a namespace's content starts inside a frame that wide, centred as `layoutScope` seats it.
const contentAt = (layout: Layout, width: number): number => FRAME_SIDE - (MARGIN - 1) + Math.floor((width - FRAME_SIDE * 2 - layout.width + (MARGIN - 1) * 2) / 2);

// A namespace whose name the relations reaching its first classes cross is widened, both sides alike, until the name
// stands clear of every stem with a blank on each side.
function besideStems(diagram: ClassDiagram, ns: Namespace, layout: Layout, width: number): number {
  if (isHorizontal(diagram.direction)) return width;
  const inside = new Set(held(ns));
  const up = diagram.direction === BT;
  const edgeOf = (name: string): number => {
    const [, y] = must(layout.positions.get(name));
    return up ? y + must(layout.sizes.get(name))[1] : y;
  };
  const crossed = diagram.relationships.flatMap((rel) =>
    inside.has(rel.source) === inside.has(rel.target) ? [] : [inside.has(rel.source) ? rel.source : rel.target]
  ).filter((name) => layout.positions.has(name));
  if (crossed.length === 0) return width;
  const edges = [...layout.positions.keys()].map(edgeOf);
  const first = up ? Math.max(...edges) : Math.min(...edges);
  const stems = [...new Set(crossed.filter((name) => edgeOf(name) === first))].map((name) => must(layout.positions.get(name))[0] + Math.floor(must(layout.sizes.get(name))[0] / 2));
  const name = displayWidth(ns.label);
  const fits = (w: number): boolean => {
    const walls = [0, ...stems.map((stem) => stem + contentAt(layout, w)).sort((a, b) => a - b), w - 1];
    return walls.some((at, i) => i > 0 && at - walls[i - 1] - 3 >= name);
  };
  let grown = width;
  while (!fits(grown) && grown < width + (name + 2) * 2) grown += 2;
  return fits(grown) ? grown : width;
}
