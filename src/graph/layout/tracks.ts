import { isHorizontal, isVertical, normalized, type Graph } from "../model.js";
import { axisOf } from "../axis.js";
import { NodeShape, BARS, STATE_MARKS } from "../shapes.js";
import { DrumRim, type NodePlacement } from "./laid.js";
import { MAX_NORMALIZED_HEIGHT, MAX_NORMALIZED_WIDTH, type GridLayout, UNSIZED } from "./grid.js";
import { DEFAULT_GAP } from "../../options.js";
import { MIN_CONTENT_HEIGHT, MIN_CONTENT_WIDTH, barThickness, contentHeightOf, contentWidthOf, HANG_COLUMNS, hangOf } from "./boxes.js";
import { NOTHING_BORROWED, borrowable, overhangCandidates, type Borrowed } from "./overhang.js";
import { sideSeatDemands } from "./seats.js";
import { expandGapsForSpreads, expandNodesForFans } from "./fans.js";
import { TURN_CELLS, expandGapsForArrows } from "./gap-arrows.js";
import { expandGapsForEdgeLabels } from "./gap-labels.js";
import { expandNodesForParallels } from "./parallels.js";
import { pushInto } from "../../must.js";

export function computeSizes(
  graph: Graph,
  layout: GridLayout,
  paddingX: number,
  paddingY: number,
  gap: number = DEFAULT_GAP,
  padless: boolean = false,
  airyLabels: boolean = true,
  denied: ReadonlySet<string> = new Set()
): void {
  const horizontalFlow = isHorizontal(normalized(graph.direction));
  const seatDemands = sideSeatDemands(graph, layout, horizontalFlow);
  const sizeOne = (id: string, placement: NodePlacement, borrowed: Borrowed): void => {
    const node = graph.nodes.get(id);
    if (node === undefined) return;
    const { col, row } = placement.grid;

    if (node.shape === NodeShape.JUNCTION) {
      layout.colWidths.set(col, Math.max(layout.colWidths.get(col) ?? UNSIZED, 1));
      layout.rowHeights.set(row, Math.max(layout.rowHeights.get(row) ?? UNSIZED, 1));
      return;
    }

    if (BARS.has(node.shape)) {
      const horizontal = isHorizontal(normalized(graph.direction));
      const across = horizontal ? Math.max(1 + paddingY, MIN_CONTENT_HEIGHT) : contentWidthOf(node, paddingX, padless, layout);
      const thin = barThickness(node.shape);
      layout.colWidths.set(col, Math.max(layout.colWidths.get(col) ?? UNSIZED, horizontal ? thin : across));
      layout.rowHeights.set(row, Math.max(layout.rowHeights.get(row) ?? UNSIZED, horizontal ? across : thin));
      return;
    }

    if (STATE_MARKS.has(node.shape)) {
      layout.colWidths.set(col, Math.max(layout.colWidths.get(col) ?? UNSIZED, MIN_CONTENT_WIDTH));
      layout.rowHeights.set(row, Math.max(layout.rowHeights.get(row) ?? UNSIZED, MIN_CONTENT_HEIGHT));
      return;
    }

    const contentWidth = Math.max(MIN_CONTENT_WIDTH, contentWidthOf(node, paddingX, padless, layout) - borrowed.cols);
    const contentHeight = Math.max(MIN_CONTENT_HEIGHT, contentHeightOf(node, paddingY, layout) - borrowed.rows);
    const seats = seatDemands.get(id) ?? { rows: 0, cols: 0 };
    const rim = layout.drums.get(id)?.rim === DrumRim.ABOVE ? 1 : 0;
    const seatedWidth = Math.max(contentWidth, seats.cols);
    const seatedHeight = Math.max(contentHeight, seats.rows + (seats.rows > 0 ? rim : 0));

    layout.colWidths.set(col, Math.max(layout.colWidths.get(col) ?? UNSIZED, seatedWidth));
    layout.rowHeights.set(row, Math.max(layout.rowHeights.get(row) ?? UNSIZED, seatedHeight));
    };

  const hang = hangOf(graph);
  const overhangers = overhangCandidates(graph, layout, denied);
  const fullMeasures = new Map<number, number>();
  for (const [id, placement] of layout.placements) {
    const node = graph.nodes.get(id);
    if (node === undefined) continue;
    const at = hang.over(placement);
    fullMeasures.set(at, Math.max(fullMeasures.get(at) ?? 0, hang.content(node, layout, paddingX, paddingY, padless)));
  }
  for (const [id, placement] of layout.placements) {
    placement.overhangs = false;
    if (!overhangers.has(id)) sizeOne(id, placement, NOTHING_BORROWED);
  }
  for (const [id, sides] of overhangers) {
    const placement = layout.placements.get(id);
    if (placement === undefined) continue;
    const borrowed = borrowable(hang, layout, placement, sides, fullMeasures);
    placement.overhangs = borrowed > 0;
    sizeOne(id, placement, hang === HANG_COLUMNS ? { cols: borrowed, rows: 0 } : { cols: 0, rows: borrowed });
  }

  const allCols = new Set<number>();
  const allRows = new Set<number>();
  for (const placement of layout.placements.values()) {
    for (let d = -1; d <= 1; d++) {
      allCols.add(placement.grid.col + d);
      allRows.add(placement.grid.row + d);
    }
  }
  for (const c of allCols) if (!layout.colWidths.has(c)) layout.colWidths.set(c, 1);
  for (const r of allRows) if (!layout.rowHeights.has(r)) layout.rowHeights.set(r, 1);

  const marksAt = new Map<number, boolean>();
  for (const [id, placement] of layout.placements) {
    const node = graph.nodes.get(id);
    const layer = axisOf(horizontalFlow).along(placement);
    const isMark = node !== undefined && STATE_MARKS.has(node.shape);
    marksAt.set(layer, (marksAt.get(layer) ?? true) && isMark);
  }
  const fanning = new Map<number, number>();
  // Counted in ONE pass: asked per node it filtered every edge of the graph, allocating an array only to read its length.
  const leavingCount = new Map<string, number>();
  for (const e of graph.edges) {
    if (e.target === e.source) continue;
    leavingCount.set(e.source, (leavingCount.get(e.source) ?? 0) + 1);
  }
  for (const [id, placement] of layout.placements) {
    const leaving = leavingCount.get(id) ?? 0;
    if (leaving < 2) continue;
    const layer = axisOf(horizontalFlow).along(placement);
    const wide = horizontalFlow && graph.nodes.get(id)?.shape === NodeShape.CHOICE_STATE ? 1 : 0;
    fanning.set(layer, Math.max(fanning.get(layer) ?? 0, TURN_CELLS + 1 + wide));
  }
  for (const [layer, only] of marksAt) {
    if (!only) continue;
    for (const d of [-1, 1]) {
      if (horizontalFlow) layout.colWidths.set(layer + d, 0);
      else layout.rowHeights.set(layer + d, 0);
    }
    const room = fanning.get(layer);
    if (room === undefined) continue;
    const gap = layer + 2;
    if (horizontalFlow) layout.colWidths.set(gap, Math.max(layout.colWidths.get(gap) ?? UNSIZED, room));
    else layout.rowHeights.set(gap, Math.max(layout.rowHeights.get(gap) ?? UNSIZED, room));
  }

  const maxCol = allCols.size > 0 ? Math.max(...allCols) : 0;
  const maxRow = allRows.size > 0 ? Math.max(...allRows) : 0;
  for (let c = 0; c < maxCol + 2; c++) if (!layout.colWidths.has(c)) layout.colWidths.set(c, gap);
  for (let r = 0; r < maxRow + 2; r++) if (!layout.rowHeights.has(r)) layout.rowHeights.set(r, 1);

  expandGapsForArrows(graph, layout, gap, padless ? { paddingX, paddingY } : undefined);
  expandGapsForSpreads(graph, layout);
  expandNodesForParallels(graph, layout, padless && airyLabels ? 1 : 0);
  expandGapsForEdgeLabels(graph, layout, padless, airyLabels);
  expandNodesForFans(graph, layout);
}

export function normalizeSizes(graph: Graph, layout: GridLayout): void {
  const vertical = isVertical(normalized(graph.direction));
  const axis = axisOf(!vertical);
  const sizes = axis.sizesAcross(layout);
  const cap = vertical ? MAX_NORMALIZED_WIDTH : MAX_NORMALIZED_HEIGHT;
  const groups = new Map<number, NodePlacement[]>();
  for (const [id, placement] of layout.placements) {
    const node = graph.nodes.get(id);
    if (node !== undefined && node.shape === NodeShape.JUNCTION) continue;
    pushInto(groups, axis.along(placement), placement);
  }

  for (const placements of groups.values()) {
    if (placements.length < 2) continue;
    const tracks = new Set(placements.map((p) => axis.across(p)));
    const target = Math.min(Math.max(...[...tracks].map((t) => sizes.get(t) ?? UNSIZED)), cap);
    for (const t of tracks) sizes.set(t, Math.max(sizes.get(t) ?? UNSIZED, target));
  }
}
