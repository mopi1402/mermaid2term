import { Direction, EdgeStyle, Graph, isHorizontal, normalized } from "../model.js";
import { alignToNeighbours } from "./align.js";
import { adjustForNegativeBounds, centreMarks, computeDrawCoords, computeSubgraphBounds, flattenBars, reserveDrumRims, reserveSpills } from "./coordinates.js";
import { assignLayers } from "./ordering/layers.js";
import { computeGapExpansions, orderLayers } from "./ordering/order.js";
import { expandSubgraphEdges, reverseAlongSubgraphs } from "./ordering/subgraph-flow.js";
import { separateSubgraphLayers } from "./ordering/subgraph-layers.js";
import { placeNodes, placeOnGrid } from "./placement.js";
import { computeSizes, normalizeSizes } from "./tracks.js";
import { fitBoxes, wrapFor, wrappedLines } from "./boxes.js";
import { LITERAL_NEWLINE } from "../../text/labels.js";
import { overhangsUnheld } from "./overhang.js";
import { needsFlankLane } from "./seats.js";
import { expandGapsForLabelSpill } from "./gap-labels.js";
import { type DrawnSides, drumBorrows, drumSeats, tightAxes } from "./padless.js";
import { DrumRim } from "./laid.js";
import { expandGapsForSubgraphs, markCrossedLabels } from "./gap-frames.js";
import { GridLayout, FLANK_LANE, UNSIZED } from "./grid.js";
import { rowsPastGap } from "../../options.js";

const MIN_GAP = 1;

interface LayoutOptions {
  paddingX: number;
  paddingY: number;
  gap: number;
  nodeGap?: number | undefined;
  rankGap?: number | undefined;
  bands: number;
  padless: boolean;
  airyLabels: boolean;
  upward?: boolean;
  snugFrames?: boolean;
  labels?: ReadonlyMap<string, string> | undefined;
  titles?: ReadonlyMap<string, string> | undefined;
  wrap?: number;
  markdownWrap?: number;
  drawnSides?: DrawnSides;
}

const OVERHANG_PASSES = 3;

const DEFAULT_LAYOUT: LayoutOptions = { paddingX: 4, paddingY: 2, gap: 4, bands: 1, padless: false, airyLabels: true };

const ONE_BAND = 1;
const FOLDABLE_FLOOR = 3;

// Whether a band count can change the layout: only a lone chain across the page folds into bands.
export const foldsIntoBands = (graph: Graph): boolean => graph.subgraphs.length === 0 && isHorizontal(normalized(graph.direction));

function onePath(graph: Graph, layerOrder: string[][]): string[] | undefined {
  if (graph.subgraphs.length > 0) return undefined;
  const chain: string[] = [];
  for (const layer of layerOrder) {
    if (layer.length !== 1) return undefined;
    chain.push(layer[0]);
  }
  if (chain.length < FOLDABLE_FLOOR || graph.edges.length !== chain.length - 1) return undefined;
  const at = new Map(chain.map((id, index) => [id, index]));
  for (const edge of graph.edges) {
    const from = at.get(edge.source);
    const to = at.get(edge.target);
    if (from === undefined || to === undefined || to - from !== 1) return undefined;
  }
  return chain;
}

// A chain cut into bands of `length`, every other band turned back and padded at its front when `serpentine`, so a
// slot index lines up across the bands.
export function serpentineBands(chain: readonly string[], length: number, serpentine: boolean): Array<Array<string | undefined>> {
  const bands: Array<Array<string | undefined>> = [];
  for (let from = 0; from < chain.length; from += length) {
    const band: Array<string | undefined> = chain.slice(from, from + length);
    if (serpentine && bands.length % 2 === 1) {
      band.reverse();
      while (band.length < length) band.unshift(undefined);
    }
    bands.push(band);
  }
  return bands;
}

function foldChain(chain: string[], length: number, serpentine: boolean): string[][] {
  const bands = serpentineBands(chain, length, serpentine);
  const order: string[][] = [];
  for (let pos = 0; pos < length; pos++) {
    const layer = bands.map((band) => band[pos]).filter((id): id is string => id !== undefined);
    if (layer.length > 0) order.push(layer);
  }
  return order;
}

// The rows a spacing adds go under each box that has another below it, between ranks in TD and between the boxes
// of one rank in LR, on top of what the row already holds.
function widenGapRows(layout: GridLayout, rowGap: number, horizontal: boolean): void {
  const extra = rowsPastGap(rowGap);
  if (extra <= 0) return;
  const lowest = new Map<number, number>();
  const lineOf = (col: number): number => (horizontal ? col : 0);
  for (const { grid } of layout.placements.values()) lowest.set(lineOf(grid.col), Math.max(lowest.get(lineOf(grid.col)) ?? grid.row, grid.row));
  const rows = new Set<number>();
  for (const { grid } of layout.placements.values()) if (grid.row < (lowest.get(lineOf(grid.col)) ?? grid.row)) rows.add(grid.row + 2);
  for (const row of rows) layout.rowHeights.set(row, (layout.rowHeights.get(row) ?? UNSIZED) + extra);
}

export function computeLayout(graph: Graph, options: Partial<LayoutOptions> = {}): GridLayout {
  const { paddingX, paddingY, padless, airyLabels } = { ...DEFAULT_LAYOUT, ...options };
  const layout = new GridLayout();
  const direction: Direction = normalized(graph.direction);
  const horizontal = isHorizontal(direction);
  // The columns run between the boxes of a rank in TD and between the ranks in LR; the rows take the other spacing.
  const gap = Math.max((horizontal ? options.rankGap : options.nodeGap) ?? options.gap ?? DEFAULT_LAYOUT.gap, MIN_GAP);
  const rowGap = horizontal ? options.nodeGap : options.rankGap;
  if (options.wrap !== undefined) layout.wrap = options.wrap;
  layout.markdownWrap = options.markdownWrap ?? layout.wrap;
  if (graph.nodeOrder.length === 0) return layout;
  for (const [id, node] of graph.nodes) {
    layout.labels.set(id, wrappedLines(options.labels?.get(id) ?? node.label, wrapFor(node, layout)).join(LITERAL_NEWLINE));
  }

  for (const [id, title] of options.titles ?? []) layout.titles.set(id, title);

  const authored = graph.gridPositions !== undefined && graph.gridPositions.size > 0 ? graph.gridPositions : undefined;

  if (authored !== undefined) {
    placeOnGrid(layout, graph.nodeOrder, authored, direction);
  } else {
    const virtual = expandSubgraphEdges(graph);
    graph.edges.push(...virtual);
    let layers: Map<string, number>;
    try {
      layers = separateSubgraphLayers(graph, assignLayers(graph));
    } finally {
      if (virtual.length > 0) graph.edges.length = graph.edges.length - virtual.length;
    }
    let layerOrder = orderLayers(graph, reverseAlongSubgraphs(graph, layers));
    const bands = Math.max(options.bands ?? DEFAULT_LAYOUT.bands, ONE_BAND);
    if (bands > ONE_BAND && foldsIntoBands(graph)) {
      const chain = onePath(graph, layerOrder);
      if (chain !== undefined && bands < chain.length) {
        const drawn = graph.edges.some((edge) => edge.style !== EdgeStyle.INVISIBLE);
        layerOrder = foldChain(chain, Math.ceil(chain.length / bands), drawn);
      }
    }
    const gapExpansions = computeGapExpansions(graph, layerOrder);
    placeNodes(layout, layerOrder, direction, gapExpansions);
    alignToNeighbours(graph, layout, layerOrder, direction);
    if (needsFlankLane(graph, layout, direction)) {
      layout.placements.clear();
      layout.gridOccupied.clear();
      placeNodes(layout, layerOrder, direction, gapExpansions, FLANK_LANE);
      alignToNeighbours(graph, layout, layerOrder, direction, FLANK_LANE);
    }
  }
  layout.padless = padless;
  layout.upward = options.upward === true;
  layout.snugFrames = options.snugFrames === true;
  if (padless) {
    layout.tightAxes = tightAxes(graph, layout, paddingY, options.drawnSides);
    layout.drums = drumSeats(graph, layout);
  }
  markCrossedLabels(graph, layout, direction);
  const denied = new Set<string>();
  const startCols = new Map(layout.colWidths);
  const startRows = new Map(layout.rowHeights);
  for (let pass = 0; pass <= OVERHANG_PASSES; pass++) {
    computeSizes(graph, layout, paddingX, paddingY, gap, padless, airyLabels, denied);
    normalizeSizes(graph, layout);
    expandGapsForLabelSpill(graph, layout, padless, airyLabels);
    expandGapsForSubgraphs(graph, layout, direction);
    const unheld = pass < OVERHANG_PASSES ? overhangsUnheld(graph, layout, paddingX, paddingY, padless, denied) : new Set<string>();
    if (unheld.size === 0) break;
    for (const id of unheld) denied.add(id);
    layout.colWidths = new Map(startCols);
    layout.rowHeights = new Map(startRows);
  }
  if (rowGap !== undefined) widenGapRows(layout, rowGap, horizontal);
  computeDrawCoords(layout);
  flattenBars(graph, layout, direction);
  fitBoxes(graph, layout, paddingX, paddingY, padless);
  let spills = computeSubgraphBounds(graph, layout);
  const settled = new Set<string>();
  while (reserveSpills(layout, spills, settled)) {
    computeDrawCoords(layout);
    flattenBars(graph, layout, direction);
    fitBoxes(graph, layout, paddingX, paddingY, padless);
    layout.subgraphBounds = [];
    spills = computeSubgraphBounds(graph, layout);
  }
  adjustForNegativeBounds(layout);
  reserveDrumRims(graph, layout);
  if (centreMarks(graph, layout, direction)) {
    layout.subgraphBounds = [];
    computeSubgraphBounds(graph, layout);
  }

  let maxX = 0;
  let maxY = 0;
  for (const [id, p] of layout.placements) {
    maxX = Math.max(maxX, p.drawX + p.drawWidth);
    const node = graph.nodes.get(id);
    const below = node !== undefined && layout.drums.get(id)?.rim === DrumRim.BELOW && drumBorrows(layout.labelOf(node), p.drawHeight);
    maxY = Math.max(maxY, p.drawY + p.drawHeight + (below ? 1 : 0));
  }
  for (const sb of layout.subgraphBounds) {
    maxX = Math.max(maxX, sb.x + sb.width);
    maxY = Math.max(maxY, sb.y + sb.height);
  }
  layout.canvasWidth = maxX;
  layout.canvasHeight = maxY;
  return layout;
}
