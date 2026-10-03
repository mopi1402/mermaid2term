import { Direction, type Graph } from "../model.js";
import { everySubgraph } from "../subgraph-tree.js";
import { computeLayout } from "../layout/passes.js";
import { type DrawnSides, tightAxes } from "../layout/padless.js";
import { markdownWrapOf } from "../layout/boxes.js";
import { wrapOf } from "../../text/wrap.js";
import { type Routes, routedOnce } from "../routing/reuse.js";
import { type RoutedEdge } from "../routing/routed.js";
import { type GridLayout } from "../layout/grid.js";
import { Canvas } from "../../canvas/canvas.js";
import { charsetOf } from "../../canvas/charsets.js";

import { COMPOSITE_FRAME, SUBGRAPH as STYLE_SUBGRAPH } from "../../canvas/keys.js";
import { DEFAULT_RENDER, type RenderOptions } from "../../options.js";
import { drawSubgraphBorders, drawSubgraphLabels, dropSubgraphBorders, fillSubgraphs, inkSubgraphs, pierceSubgraphBorders, reshapeSubgraphs } from "./frames.js";
import { drawEdges, flushHeads } from "./edges.js";
import { spaceWideMarks, weighMarkFans } from "./mark-fans.js";
import { drawNodes, dropNodeBorders, fadeNodes, groundNoteFrames, restyleBorders } from "./nodes.js";
import { padNodeBorders } from "./pad-nodes.js";
import { markGradients } from "./gradient.js";
import { type FoldedLabels, foldForBudget, foldTitles } from "./fold.js";
import { widestLine } from "../../text/width.js";
import { lowerGeometry, mirrorGeometry, rightGeometry, mirrorSubgraphDirections } from "./mirror.js";
import { labelLines, widestLabelLine } from "../../text/labels.js";
import { type ColorSlots } from "../../paint/color-slots.js";

const CANVAS_MARGIN = 4;
// Never below three, or a run is too short to read as a run.
const KEEP_IDENTICAL_ROWS = 3;
const KEEP_IDENTICAL_COLS = 3;
const CELL_MARGIN = 2;

export function renderGraph(graph: Graph, options: Partial<RenderOptions> = {}, foldBudget?: number, folds?: FoldedLabels): string {
  const canvas = renderGraphCanvas(graph, options, foldBudget, undefined, folds);
  return canvas === undefined ? "" : canvas.toString();
}

export interface ThemeFills {
  node: boolean;
  cluster: boolean;
  // The `neo` look under a theme with `useGradient`: every box's border is marked for its gradient.
  gradient: boolean;
  colorSlots: ColorSlots | undefined;
}
const NO_FILLS: ThemeFills = { node: false, cluster: false, gradient: false, colorSlots: undefined };

export function renderGraphCanvas(
  graph: Graph,
  options: Partial<RenderOptions> = {},
  foldBudget?: number,
  fills: ThemeFills = NO_FILLS,
  folds?: FoldedLabels
): Canvas | undefined {
  return drawGraph(graph, options, foldBudget, fills, folds)?.canvas;
}

// The canvas with the geometry it was drawn from, mirrored as drawn, for a check that reads both.
export interface GraphDrawing {
  readonly canvas: Canvas;
  readonly layout: GridLayout;
  readonly routed: RoutedEdge[];
}

// Under a budget the frames' titles fold whenever the drawing runs past it, the boxes' labels only once the fit asks
// them to: a drawing that holds the budget is drawn once.
export function drawGraph(
  graph: Graph,
  options: Partial<RenderOptions> = {},
  foldBudget?: number,
  fills: ThemeFills = NO_FILLS,
  folds?: FoldedLabels
): GraphDrawing | undefined {
  if (graph.nodeOrder.length === 0) return undefined;
  const whole = drawFolded(graph, options, fills, folds);
  if (foldBudget === undefined || widestLine(whole.canvas.toString()) <= foldBudget) return whole;
  const labels = folds?.labels ?? new Map<string, string>();
  const routes: Routes = new Map();
  const { drawing, titles } = foldTitles(whole, foldBudget, labels, (f) => drawFolded(graph, options, fills, f, routes));
  if (options.wrapLabels !== true) return drawing;
  const kept = foldForBudget(graph, options, foldBudget, (f) => drawFolded(graph, options, NO_FILLS, f, routes), titles);
  return kept.drawing !== undefined && fills === NO_FILLS ? kept.drawing : drawFolded(graph, options, fills, kept.folds, routes);
}

// BT and RL are drawn as TB and LR, then mirrored: the graph is turned for the drawing and turned back after it,
// whatever the drawing throws.
function drawFolded(graph: Graph, options: Partial<RenderOptions>, fills: ThemeFills, folded: FoldedLabels | undefined, routes?: Routes): GraphDrawing {
  const direction = graph.direction;
  const flipV = direction === Direction.BT;
  const flipH = direction === Direction.RL;
  const declared = everySubgraph(graph).map((sg) => sg.direction);
  if (flipV || flipH) {
    for (const sg of everySubgraph(graph)) if (sg.composite && !sg.concurrent && sg.direction === undefined) sg.direction = Direction.LR;
  }
  if (flipV) graph.direction = Direction.TB;
  else if (flipH) graph.direction = Direction.LR;
  if (flipV || flipH) mirrorSubgraphDirections(graph, flipV);
  try {
    return drawTurned(graph, options, fills, folded, flipV, flipH, routes);
  } finally {
    graph.direction = direction;
    everySubgraph(graph).forEach((sg, i) => (sg.direction = declared[i]));
  }
}

function drawTurned(
  graph: Graph,
  options: Partial<RenderOptions>,
  fills: ThemeFills,
  folded: FoldedLabels | undefined,
  flipV: boolean,
  flipH: boolean,
  routes: Routes | undefined
): GraphDrawing {
  const { charset, paddingX, paddingY, roundedEdges, gap, nodeGap, rankGap, compact, bands, borders, airyLabels, snugFrames, config } = { ...DEFAULT_RENDER, ...options };

  const cs = charsetOf(charset);

  const layoutOptions = {
    paddingX,
    paddingY,
    gap,
    nodeGap,
    rankGap,
    bands,
    padless: borders === "padless",
    airyLabels,
    snugFrames,
    upward: flipV,
    labels: folded?.labels,
    titles: folded?.titles,
    wrap: wrapOf(config),
    markdownWrap: markdownWrapOf(config),
  };
  let layout = computeLayout(graph, layoutOptions);
  let routed = routedOnce(graph, layout, flipV, routes);
  // A padless box takes its form from the sides its links meet, guessed before routing: where the routing met them on
  // other sides, the layout is made again once on the sides drawn.
  if (layoutOptions.padless) {
    const drawnSides: DrawnSides = new Map(routed.map((re) => [re.edge, [re.startDir, re.endDir]]));
    const axes = tightAxes(graph, layout, paddingY, drawnSides);
    if ([...axes].some(([id, axis]) => layout.tightAxes.get(id) !== axis)) {
      layout = computeLayout(graph, { ...layoutOptions, drawnSides });
      routed = routedOnce(graph, layout, flipV, routes);
    }
  }
  // A box on the drawing's top row has no gap over it: the loops nested round its own ride rows above the page.
  const above = Math.max(0, ...routed.flatMap((re) => re.drawPath.map(([, y]) => -y)));
  if (above > 0) lowerGeometry(layout, routed, above);
  // A run rounding a frame on its left rides columns before the drawing's first, as one over its top rides rows above.
  const before = Math.max(0, ...routed.flatMap((re) => re.drawPath.map(([x]) => -x)));
  if (before > 0) rightGeometry(layout, routed, before);

  let width = layout.canvasWidth + before + CANVAS_MARGIN;
  let height = layout.canvasHeight + above + CANVAS_MARGIN;
  for (const re of routed) {
    for (const [x, y] of re.drawPath) {
      width = Math.max(width, x + CELL_MARGIN);
      height = Math.max(height, y + CELL_MARGIN);
    }
    // A loop's label stands past the run it rides: mirrored across the page, the room it needs lies before the drawing.
    if (re.edge.source === re.edge.target && re.label !== "") {
      width = Math.max(width, ...re.drawPath.map(([x]) => x + CELL_MARGIN + widestLabelLine(re.label)));
    }
  }
  // Mirrored in the GEOMETRY, never in the finished canvas: flipping the drawn cells turns every shape over with it,
  // and a parallelogram leans the wrong way.
  if (flipV || flipH) mirrorGeometry(layout, routed, width, height, flipV);
  const lift = Math.max(0, ...routed.map((re) => labelLines(re.label) - 1));
  if (lift > 0) lowerGeometry(layout, routed, lift);
  const canvas = new Canvas(width, height + lift);

  drawSubgraphBorders(canvas, layout, cs);
  drawNodes(canvas, graph, layout, cs);
  const padless = borders === "padless";
  drawEdges(canvas, graph, routed, cs, roundedEdges, layout, flushHeads(graph, layout, padless, paddingX), {
    ownRight: padless,
    air: padless && airyLabels ? 1 : 0,
  });
  pierceSubgraphBorders(canvas, layout, cs);
  weighMarkFans(canvas, layout, routed);
  spaceWideMarks(canvas, graph, layout);
  drawSubgraphLabels(canvas, layout);
  restyleBorders(canvas, graph, layout, cs);
  reshapeSubgraphs(canvas, layout, cs);
  groundNoteFrames(canvas, graph, layout);
  if (borders === "borderless") {
    dropNodeBorders(canvas, graph, layout, cs, fills.node);
    if (fills.cluster) dropSubgraphBorders(canvas, layout);
  } else if (borders === "padless") padNodeBorders(canvas, graph, layout, cs);
  fadeNodes(canvas, graph, layout);
  fillSubgraphs(canvas, layout);
  inkSubgraphs(canvas, layout, fills.colorSlots);
  if (fills.gradient) markGradients(canvas, graph, layout, cs);
  const unused = canvas.raise(lift);
  if (unused > 0) lowerGeometry(layout, routed, -unused);

  if (flipV || flipH) canvas.alignTopLeft();
  if (compact) canvas.compactRuns(KEEP_IDENTICAL_ROWS, KEEP_IDENTICAL_COLS, new Set([STYLE_SUBGRAPH, COMPOSITE_FRAME]));
  return { canvas, layout, routed };
}

