import { normalized, isHorizontal, type Graph, type Node } from "../model.js";
import { axisOf, type Axis, type Placed } from "../axis.js";
import { NodeShape, STATE_MARKS } from "../shapes.js";
import { labelRowsOf } from "../../text/labels.js";
import { centredOffset, longestWord, widestOf, wordWrap } from "../../text/width.js";
import { TIGHT_SHAPES, wallPadding } from "./padless.js";
import { TightAxis, type NodePlacement } from "./laid.js";
import { type GridLayout, UNSIZED } from "./grid.js";
import { MAX_LABEL_WIDTH, wrapOf } from "../../text/wrap.js";
import type { Declared } from "../../source/config.js";
import { MARKDOWN_AUTO_WRAP_KEY } from "../../source/source.js";
import { FOLD_ROWS } from "../../canvas/shape-frame.js";
import { ensured } from "../../must.js";

// One and not three: a flat floor spends two blank columns per box at the tightest rung of the ladder, which is
// exactly the rung that decides whether the drawing fits.
export const MIN_CONTENT_WIDTH = 1;

export const MIN_CONTENT_HEIGHT = 1;

const SHEAR_CHROME = 4;

const BAND_ROWS = 1;

const BAR_THICKNESS = 2;

const SOLID_THICKNESS = 1;



export const barThickness = (shape: NodeShape): number =>
  shape === NodeShape.OUTLINED_BAR ? BAR_THICKNESS : SOLID_THICKNESS;

const TOP_ROW_CHROME: ReadonlySet<NodeShape> = new Set([
  NodeShape.DIVIDED_RECTANGLE,
  NodeShape.NOTCHED_RECTANGLE,
  NodeShape.NOTCHED_PENTAGON,
  NodeShape.SLOPED_RECTANGLE,
  NodeShape.WINDOW_PANE,
  NodeShape.FOLDER,
  NodeShape.STACKED_RECTANGLE,
  NodeShape.STACKED_DOCUMENT,
]);

// A box whose lid takes a row of its own, a rule or a step under it.
export const lidded = (shape: NodeShape): boolean => TOP_ROW_CHROME.has(shape);

const SHAPE_CHROME: ReadonlyMap<NodeShape, number> = new Map([
  [NodeShape.SUBROUTINE, 2],
  [NodeShape.HORIZONTAL_CYLINDER, 2],
  [NodeShape.ASYMMETRIC, 1],
  [NodeShape.HEXAGON, 2],
  [NodeShape.LINED_RECTANGLE, 1],
  [NodeShape.LINED_DOCUMENT, 1],
  [NodeShape.WINDOW_PANE, 1],
  [NodeShape.STACKED_RECTANGLE, 1],
  [NodeShape.STACKED_DOCUMENT, 1],
  [NodeShape.DISPLAY, 1],
  [NodeShape.PARALLELOGRAM, SHEAR_CHROME],
  [NodeShape.PARALLELOGRAM_ALT, SHEAR_CHROME],
  [NodeShape.TRAPEZOID, SHEAR_CHROME],
  [NodeShape.TRAPEZOID_ALT, SHEAR_CHROME],
]);

const SHAPE_FLOOR: ReadonlyMap<NodeShape, number> = new Map([
  [NodeShape.HEXAGON, 2],
  [NodeShape.PARALLELOGRAM, SHEAR_CHROME],
  [NodeShape.PARALLELOGRAM_ALT, SHEAR_CHROME],
  [NodeShape.TRAPEZOID, SHEAR_CHROME * 2],
  [NodeShape.TRAPEZOID_ALT, SHEAR_CHROME * 2],
  [NodeShape.COLLAPSED_GROUP, FOLD_ROWS],
]);

const NAME_MARKS_CHROME = 2;

const NAME_MARKED_SHAPES: ReadonlySet<NodeShape> = new Set([NodeShape.DIAMOND, NodeShape.CIRCLE, NodeShape.DOUBLE_CIRCLE]);

export const chromeOf = (shape: NodeShape, padless: boolean): number =>
  (SHAPE_CHROME.get(shape) ?? 0) + (padless && NAME_MARKED_SHAPES.has(shape) ? NAME_MARKS_CHROME : 0);

const paddingOf = (node: Node, paddingX: number, padless: boolean, layout: GridLayout | undefined): number => {
  const padding = layout === undefined ? paddingX : Math.max(paddingX, wallPadding(node, layout, padless));
  return padless && TIGHT_SHAPES.has(node.shape) ? padding - (padding % 2) : padding;
};

export function contentWidthOf(node: Node, paddingX: number, padless = false, layout?: GridLayout): number {
  if (node.shape === NodeShape.JUNCTION) return 1;
  const lines = labelRowsOf(layout === undefined ? node.label : layout.labelOf(node));
  const textWidth = widestOf(lines);
  const padding = paddingOf(node, paddingX, padless, layout);
  const floor = SHAPE_FLOOR.get(node.shape) ?? MIN_CONTENT_WIDTH;
  return Math.max(textWidth + padding + chromeOf(node.shape, padless), floor);
}

export function contentHeightOf(node: Node, paddingY: number, layout: GridLayout): number {
  if (node.shape === NodeShape.JUNCTION || STATE_MARKS.has(node.shape)) return MIN_CONTENT_HEIGHT;
  const lines = wrappedLines(layout.labelOf(node), wrapFor(node, layout)).length;
  if (layout.drums.has(node.id)) return lines;
  const axis = layout.tightAxes.get(node.id);
  if (axis === TightAxis.VERTICAL) return lines;
  if (axis === TightAxis.HORIZONTAL) return lines + (node.shape === NodeShape.NOTE ? 0 : paddingY);
  const floor = node.shape === NodeShape.COLLAPSED_GROUP ? lines + FOLD_ROWS - 1 : MIN_CONTENT_HEIGHT;
  const band = TOP_ROW_CHROME.has(node.shape) ? BAND_ROWS : 0;
  return Math.max(lines + band, 1 + paddingY, floor);
}

// mermaid 12's top-level `markdownAutoWrap: false` keeps a markdown label on one line, a plain one still wrapping.
export const markdownWrapOf = (said: Declared, wrap = wrapOf(said)): number =>
  said[MARKDOWN_AUTO_WRAP_KEY] === String(false) ? Number.POSITIVE_INFINITY : wrap;

// mermaid 12 lays these on one line whatever their length (#8227): their outline grows to the text instead.
const UNWRAPPED_SHAPES: ReadonlySet<NodeShape> = new Set([NodeShape.STADIUM, NodeShape.CIRCLE, NodeShape.DIAMOND, NodeShape.DOUBLE_CIRCLE]);

export const wrapFor = (node: Node, layout: Pick<GridLayout, "wrap" | "markdownWrap">): number => {
  if (UNWRAPPED_SHAPES.has(node.shape)) return Number.POSITIVE_INFINITY;
  return node.markdown ? layout.markdownWrap : layout.wrap;
};

const wraps = new Map<number, Map<string, readonly string[]>>();

const WRAP_MEMORY = 4096;

// Memoised on the LABEL: the fit ladder redraws the same graph up to seventy times and wraps the same text each
// round. The table is dropped whole past `WRAP_MEMORY` rather than evicted one by one.
export function wrappedLines(label: string, wrap = MAX_LABEL_WIDTH): readonly string[] {
  const atWidth = ensured(wraps, wrap, () => new Map<string, readonly string[]>());
  const known = atWidth.get(label);
  if (known !== undefined) return known;
  const lines = labelRowsOf(label);
  // mermaid never wraps narrower than the widest word: the box holds it anyway, and the other words pack up to it.
  const width = Math.max(wrap, longestWord(label));
  const wrapped = lines.flatMap((line) => wordWrap(line, width));
  if (atWidth.size >= WRAP_MEMORY) atWidth.clear();
  atWidth.set(label, wrapped);
  return wrapped;
}

export function labelWidthWithin(node: Node, width: number, paddingX: number, padless = false, layout?: GridLayout): number {
  return width - paddingOf(node, paddingX, padless, layout) - chromeOf(node.shape, padless);
}

export interface Hang {
  over(p: Placed): number;
  along(p: Placed): number;
  cell(over: number, along: number): readonly [col: number, row: number];
  sizes(layout: GridLayout): Map<number, number>;
  content(node: Node, layout: GridLayout, paddingX: number, paddingY: number, padless: boolean): number;
}

export const HANG_COLUMNS: Hang = {
  over: (p) => p.grid.col,
  along: (p) => p.grid.row,
  cell: (over, along) => [over, along],
  sizes: (layout) => layout.colWidths,
  content: (node, layout, paddingX, _paddingY, padless) => contentWidthOf(node, paddingX, padless, layout),
};

const HANG_ROWS: Hang = {
  over: (p) => p.grid.row,
  along: (p) => p.grid.col,
  cell: (over, along) => [along, over],
  sizes: (layout) => layout.rowHeights,
  content: (node, layout, _paddingX, paddingY) => contentHeightOf(node, paddingY, layout),
};

export const hangOf = (graph: Graph): Hang => (isHorizontal(normalized(graph.direction)) ? HANG_ROWS : HANG_COLUMNS);

export function trackContents(graph: Graph, layout: GridLayout, paddingX: number, paddingY: number, padless: boolean): Map<number, number> {
  const hang = hangOf(graph);
  const measures = new Map<number, number>();
  for (const [id, p] of layout.placements) {
    const node = graph.nodes.get(id);
    if (node === undefined || p.bar || p.mark) continue;
    const at = hang.over(p);
    measures.set(at, Math.max(measures.get(at) ?? 0, hang.content(node, layout, paddingX, paddingY, padless)));
  }
  return measures;
}

export const hangMeasure = (
  node: Node,
  p: Placed,
  layout: GridLayout,
  hang: Hang,
  trackContent: ReadonlyMap<number, number>,
  paddingX: number,
  paddingY: number,
  padless: boolean
): number =>
  Math.max(
    hang.content(node, layout, paddingX, paddingY, padless),
    hang.sizes(layout).get(hang.over(p)) ?? UNSIZED,
    trackContent.get(hang.over(p)) ?? 0
  );

export function fitBoxes(graph: Graph, layout: GridLayout, paddingX: number, paddingY: number, padless: boolean): void {
  const hang = hangOf(graph);
  const hangsColumns = hang === HANG_COLUMNS;
  const trackContent = trackContents(graph, layout, paddingX, paddingY, padless);
  for (const [id, p] of layout.placements) {
    const node = graph.nodes.get(id);
    if (node === undefined || p.bar || p.mark) continue;
    const { col, row } = p.grid;

    const track = layout.colWidths.get(col) ?? UNSIZED;
    const measure = (): number => hangMeasure(node, p, layout, hang, trackContent, paddingX, paddingY, padless);
    const own = p.overhangs && hangsColumns ? measure() : track;
    if (own !== track) {
      const width = p.drawWidth + own - track;
      p.drawX = recentred(p.drawX, p.drawWidth, width);
      p.drawWidth = width;
      p.own = true;
    }
    if (own > track) occupyCovered(layout, p, id, axisOf(true));

    const rows = layout.rowHeights.get(row) ?? UNSIZED;
    const ownRows = p.overhangs && !hangsColumns ? measure() : rows;
    if (ownRows < rows) {
      p.drawY += centredOffset(rows, ownRows);
      p.drawHeight -= rows - ownRows;
      p.own = true;
    } else if (ownRows > rows) {
      const height = p.drawHeight + ownRows - rows;
      p.drawY = recentred(p.drawY, p.drawHeight, height);
      p.drawHeight = height;
      p.own = true;
      occupyCovered(layout, p, id, axisOf(false));
    }
  }
}

const recentred = (start: number, size: number, next: number): number => start + Math.floor(size / 2) - Math.floor(next / 2);

// A box grown past its own track takes every track further along that its ink now covers.
function occupyCovered(layout: GridLayout, p: NodePlacement, id: string, axis: Axis): void {
  const sizes = axis.sizesAlong(layout);
  const at = axis.along(p);
  const across = axis.across(p);
  const start = axis.horizontal ? p.drawX : p.drawY;
  const end = start + (axis.horizontal ? p.drawWidth : p.drawHeight);
  const drawn = (t: number): number => layout.gridToDraw(...axis.cell(t, across))[axis.horizontal ? 0 : 1];
  for (let t = at - 2; t >= 0 && drawn(t) + (sizes.get(t) ?? UNSIZED) > start; t--) layout.occupy(...axis.cell(t, across), id);
  for (let t = at + 2; sizes.has(t) && drawn(t) < end; t++) layout.occupy(...axis.cell(t, across), id);
}
