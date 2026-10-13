import { totalValue, treemapTotal, type Treemap, type TreemapNode } from "./model.js";
import { d3Format } from "../../text/format.js";
import { must } from "../../must.js";
import { centredAt, displayWidth, truncateToWidth } from "../../text/width.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { spanOf } from "../../canvas/extent.js";
import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import { LABEL, TREEMAP_LEAF_MARK, TREEMAP_SEAT_JOIN, treemapKey } from "../../canvas/keys.js";
import { ROOT_SEAT, byValue, treemapSeats, type TreemapSeats } from "./seats.js";
import { titledAbove } from "../@common/titled.js";
import { colourToHex } from "../../colour/colours.js";
import { fillOf, PROP_COLOR, PROP_STROKE } from "../../source/css.js";
import { slabOutline } from "../../graph/render/slabs.js";
import { edgesOf } from "../../canvas/extent.js";
import { OWN_KEY, widenBox } from "../../canvas/fit-frame.js";
import { fillInterior, frame } from "../../canvas/shape-frame.js";
import { cornersOf } from "../../canvas/corners.js";
import { type BorderMode } from "../../source/config.js";

// What a box is drawn with: the charset, the scales' seats, and the ground its parent stands on.
interface Pen {
  readonly cs: CharSet;
  readonly seats: TreemapSeats;
  readonly ground: string;
  // The fill seat the parent stands on, `ROOT_SEAT` for the root's transparent one.
  readonly seat: number;
  readonly classDefs: ReadonlyMap<string, ReadonlyMap<string, string>>;
  // How a value is written, none drawn under `showValues: false`.
  readonly format: ((value: number) => string) | undefined;
  // Every box drawn, its outline's key with it, for the border mode to go over once they are all down.
  readonly boxes: Box[];
  // The most columns a leaf's name holds its box open to where the map is squeezed into a width budget.
  readonly leafCap: number | undefined;
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  // The outline's key, the same ink on the parent's ground, and the slab of the box's own ground.
  readonly key: string;
  readonly rim: string;
  readonly slab: string;
  // Whether the box's ground differs from its parent's, so a slab of it still shows the box.
  readonly distinct: boolean;
}

const MIN_BOX_W = 4;
const MIN_BOX_H = 3;
const GAP = 1;

const WIDTH_FACTOR = 1.6;
const WIDTH_FLOOR = 60;
const WIDTH_CEILING = 120;

const BOX_ROWS = 4;
const BALANCE_PASSES = 3;

const LABEL_KEPT = 3;

const DOLLAR = "$";
const PLAIN_FORMAT = ",";
const DOLLAR_GROUPED = "$0,0";
const PRECISION_RE = /\.\d+/u;

// mermaid's treemap renderer: its own `$` forms laid over d3's specifiers, one it cannot read falling back to `,`.
function valueFormatOf(spec: string): (value: number) => string {
  const plain = must(d3Format(PLAIN_FORMAT));
  if (spec === DOLLAR_GROUPED) return (value) => DOLLAR + plain(value);
  if (!spec.startsWith(DOLLAR)) return d3Format(spec) ?? plain;
  const rest = spec.includes(PLAIN_FORMAT) ? PLAIN_FORMAT + (PRECISION_RE.exec(spec)?.[0] ?? "") : spec.slice(DOLLAR.length);
  const format = d3Format(rest);
  return format === undefined ? plain : (value) => DOLLAR + format(value);
}

// `filled` says a theme lays the boxes' grounds: only then can a borderless box do without its outline.
export function renderTreemap(diagram: Treemap, cs: CharSet = UNICODE, borders: BorderMode = "default", filled = false, budget?: number): Canvas {
  if (diagram.roots.length === 0) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);
  if (treemapTotal(diagram) <= 0) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);

  const height = computeHeight(diagram.roots);
  const minWidth = computeMinWidth(diagram.roots, Number.POSITIVE_INFINITY);
  const own = Math.max(minWidth, Math.min(WIDTH_CEILING, Math.max(WIDTH_FLOOR, Math.trunc(minWidth * WIDTH_FACTOR))));
  const leafCap = budget === undefined || budget >= own ? undefined : capWithin(diagram.roots, budget);
  const width = leafCap === undefined || budget === undefined ? own : Math.max(computeMinWidth(diagram.roots, leafCap), budget);

  const canvas = new Canvas(width, height);
  const format = diagram.showValues ? valueFormatOf(diagram.valueFormat) : undefined;
  const boxes: Box[] = [];
  const pen = { cs, seats: treemapSeats(diagram.roots), ground: String(ROOT_SEAT), seat: ROOT_SEAT, classDefs: diagram.classDefs, format, boxes, leafCap };
  layoutNodes(canvas, pen, diagram.roots, 0, 0, width, height);
  if (borders === "padless") for (const box of boxes) padOutline(canvas, box);
  if (borders === "borderless" && filled) for (const { x, y, w, h, key, slab, distinct } of boxes) if (distinct) slabOutline(canvas, edgesOf({ x, y, w, h }), slab, (r, c) => canvas.getStyle(r, c) === key);
  return titledAbove(canvas, diagram.title, { key: LABEL, left: undefined, budget });
}

function computeHeight(nodes: TreemapNode[]): number {
  let tallest = 0;
  for (const node of nodes) {
    const own = node.children.length > 0 ? computeHeight(node.children) + BOX_ROWS : BOX_ROWS;
    tallest = Math.max(tallest, own);
  }
  return tallest;
}

// Past the budget the longest names are cut first, a column at a time, down to the narrowest boxes.
function capWithin(roots: TreemapNode[], budget: number): number {
  let cap = computeMinWidth(roots, Number.POSITIVE_INFINITY);
  while (cap > MIN_BOX_W && computeMinWidth(roots, cap) > budget) cap -= 1;
  return cap;
}

const leafWidth = (node: TreemapNode, leafCap: number): number => Math.max(MIN_BOX_W, Math.min(leafCap, displayWidth(node.label) + 2));

const minOf = (node: TreemapNode, leafCap: number): number => (node.children.length > 0 ? computeMinWidth(node.children, leafCap) + 2 : leafWidth(node, leafCap));

function computeMinWidth(nodes: TreemapNode[], leafCap: number): number {
  return spanOf(nodes.map((node) => minOf(node, leafCap)), GAP);
}

function layoutNodes(canvas: Canvas, pen: Pen, nodes: TreemapNode[], x: number, y: number, w: number, h: number): void {
  if (nodes.length === 0 || w < MIN_BOX_W || h < MIN_BOX_H) return;
  const total = nodes.reduce((sum, n) => sum + totalValue(n), 0);
  if (total <= 0) return;

  const sorted = byValue(nodes);
  sliceLayout(canvas, pen, sorted, x, y, w, h, total);
}

function sliceLayout(
  canvas: Canvas,
  pen: Pen,
  nodes: TreemapNode[],
  x: number,
  y: number,
  w: number,
  h: number,
  total: number
): void {
  let gaps = nodes.length - 1;
  let usable = w - GAP * gaps;
  if (usable < MIN_BOX_W * nodes.length) {
    usable = w;
    gaps = 0;
  }

  // Every box keeps its names as whole as the budget lets them, whole where the map is drawn at its own width.
  const leafCap = pen.leafCap ?? Number.POSITIVE_INFINITY;
  const minimums = nodes.map((node) => minOf(node, leafCap));
  const sizes = nodes.map((node) => (totalValue(node) / total) * usable);

  for (let pass = 0; pass < BALANCE_PASSES; pass++) {
    let deficit = 0;
    let surplus = 0;
    for (let i = 0; i < sizes.length; i++) {
      const minimum = minimums[i];
      const size = sizes[i];
      if (size < minimum) {
        deficit += minimum - size;
        sizes[i] = minimum;
      } else {
        surplus += size - minimum;
      }
    }
    if (deficit > 0 && surplus > 0) {
      const scale = Math.max(0, 1 - deficit / surplus);
      for (let i = 0; i < sizes.length; i++) {
        const minimum = minimums[i];
        const size = sizes[i];
        if (size > minimum) sizes[i] = minimum + (size - minimum) * scale;
      }
    }
  }

  const widths = sizes.map((size, i) => Math.max(minimums[i], Math.round(size)));
  const drawn = widths.reduce((sum, width) => sum + width, 0);
  if (drawn !== usable) {
    let largest = 0;
    for (let i = 1; i < widths.length; i++) if ((widths[i]) > (widths[largest])) largest = i;
    widths[largest] = Math.max(minimums[largest], (widths[largest]) + (usable - drawn));
  }

  let left = x;
  nodes.forEach((node, i) => {
    const width = Math.min(widths[i], x + w - left);
    if (width < MIN_BOX_W) return;
    drawNode(canvas, pen, node, left, y, width, h);
    left += width + (i < gaps ? GAP : 0);
  });
}

function drawNode(canvas: Canvas, pen: Pen, node: TreemapNode, x: number, y: number, w: number, h: number): void {
  if (w < MIN_BOX_W || h < MIN_BOX_H) return;

  const { cs, seats } = pen;
  const isSection = node.children.length > 0;
  const horizontal = isSection ? cs.lineDottedH : cs.horizontal;
  const vertical = isSection ? cs.lineDottedV : cs.vertical;
  // A section stands on its own fill seat over its parent's ground, a leaf on its parent's seat once more; a
  // `classDef` fill takes the seat's place, its stroke the outline's and its colour the words', as mermaid inlines them.
  const props = node.className === undefined ? undefined : pen.classDefs.get(node.className);
  const hexOf = (prop: string | undefined): string | undefined => (prop === undefined ? undefined : colourToHex(prop));
  const fill = hexOf(props === undefined ? undefined : fillOf(props)) ?? "";
  const stroke = hexOf(props?.get(PROP_STROKE));
  const color = hexOf(props?.get(PROP_COLOR));
  const own = seats.fill.get(node) ?? ROOT_SEAT;
  const ground = isSection ? pen.ground + TREEMAP_SEAT_JOIN + String(own) + fill : pen.ground + TREEMAP_LEAF_MARK + fill;
  const style = treemapKey(isSection ? "frame" : "box", ground, undefined, stroke);
  // A leaf is laid over its parent in the parent's seat, a section in its own.
  const distinct = fill !== "" || (isSection ? own : pen.seat) !== ROOT_SEAT;
  const seat = seats.label.get(node);

  fillInterior(canvas, x, y, w, h, treemapKey("blank", ground));

  frame(canvas, x, y, w, h, cs, style, cornersOf(cs, false), [vertical, vertical], { rules: [horizontal, horizontal], merge: false });
  // The rim stands on the parent's ground but keeps the section's own seat: mermaid strokes a section its own cScalePeer.
  const rim = treemapKey(isSection ? "frame" : "box", pen.ground, isSection ? own : undefined, stroke);
  pen.boxes.push({ x, y, w, h, key: style, rim, slab: treemapKey("slab", ground), distinct });

  const inner = w - 2;
  const valueKey = treemapKey("value", ground, seat, color);
  // mermaid writes a value only where it has one, and hides one its cell cannot hold.
  const total = isSection ? totalValue(node) : node.value;
  const shown = pen.format === undefined || total <= 0 ? "" : pen.format(total);
  // A section's total ends its header row, the name keeping a few columns before it.
  const kept = Math.min(displayWidth(node.label), LABEL_KEPT);
  const headerValue = isSection && shown !== "" && inner - displayWidth(shown) - 2 * GAP >= kept ? shown : "";
  const room = headerValue === "" ? inner : inner - displayWidth(headerValue) - 2 * GAP;
  const label = truncateToWidth(node.label, room);
  const centred = centredAt(inner, label);
  const at = centred + displayWidth(label) <= room ? centred : centredAt(room, label);
  canvas.putText(y + 1, x + 1 + Math.max(0, at), label, treemapKey("label", ground, seat, color));
  if (headerValue !== "") canvas.putText(y + 1, x + 1 + inner - GAP - displayWidth(headerValue), headerValue, valueKey);

  if (!isSection && shown !== "" && h >= BOX_ROWS && displayWidth(shown) <= inner) {
    canvas.putText(y + 2, x + 1 + Math.max(0, centredAt(inner, shown)), shown, valueKey);
  }

  if (isSection) {
    const innerHeight = h - 3;
    if (inner >= MIN_BOX_W && innerHeight >= MIN_BOX_H) {
      layoutNodes(canvas, { ...pen, ground, seat: own }, node.children, x + 1, y + 2, inner, innerHeight);
    }
  }
}

// Under padless the outline rides the cell edges as a subgraph frame's does, its rules on the parent's ground, the box's
// own filling the cells inside them.
function padOutline(canvas: Canvas, { x, y, w, h, key, rim }: Box): void {
  widenBox(canvas, edgesOf({ x, y, w, h }), key, false, OWN_KEY, key, rim);
}
