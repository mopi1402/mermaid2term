import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import type { BlockDiagram } from "./model.js";
import { BLOCK_PAD, COL_GAP, MARGIN, MAX_BLOCK_PAD,MIN_CANVAS_H, MIN_CANVAS_W, type Placed, type Sized } from "./metrics.js";
import { columnGaps, computeAllSizes, computePositions, rowGaps, sizedGrid } from "./layout.js";
import { drawBlocks, drawGroups, drawLinkTees, drawLinks } from "./draw.js";
import { boardOf } from "./route.js";
import { dressComposites, groundComposites, styleBlocks } from "./styling.js";
import { type ColorSlots } from "../../paint/color-slots.js";
import { type BorderMode } from "../../source/config.js";
import { blockBorders, padGroups } from "./borders.js";

export function renderBlockDiagram(
  diagram: BlockDiagram,
  cs: CharSet = UNICODE,
  paddingX = BLOCK_PAD,
  gap = COL_GAP,
  colorSlots: ColorSlots | undefined = undefined,
  rounded = true,
  borders: BorderMode = "default",
  filled = false
): Canvas {
  if (diagram.blocks.length === 0) return new Canvas(1, 1);

  const sizes: Sized = new Map();
  computeAllSizes(diagram.blocks, sizes, Math.min(paddingX, MAX_BLOCK_PAD), gap);

  const { columns, grid, colWidths, rowHeights } = sizedGrid(diagram.blocks, diagram.columns, sizes, gap);
  const colGaps = columnGaps(grid, diagram.links, columns, gap);
  const gapsDown = rowGaps(grid, diagram.links);

  const positions: Placed = new Map();
  computePositions(grid, colWidths, rowHeights, sizes, positions, gap, colGaps, gapsDown);

  const width = Math.max(
    MIN_CANVAS_W,
    MARGIN * 2 + colWidths.reduce((a, b) => a + b, 0) + colGaps.reduce((a, b) => a + b, 0)
  );
  const height = Math.max(
    MIN_CANVAS_H,
    MARGIN * 2 + rowHeights.reduce((a, b) => a + b, 0) + gapsDown.reduce((a, b) => a + b, 0)
  );

  const canvas = new Canvas(width, height);
  drawGroups(canvas, diagram.blocks, positions, sizes, cs);
  const board = boardOf(diagram.blocks, positions, sizes);
  const links = drawLinks(canvas, diagram.links, positions, sizes, cs, board, rounded);
  drawBlocks(canvas, diagram.blocks, positions, sizes, cs);
  drawLinkTees(canvas, links, diagram.blocks, cs);
  const padless = borders === "padless";
  if (padless) padGroups(canvas, diagram.blocks, positions, sizes);
  dressComposites(canvas, diagram.blocks, positions, sizes, colorSlots, padless);
  styleBlocks(canvas, diagram, diagram.blocks, positions, sizes, blockBorders(borders, filled, cs, rounded, links));
  groundComposites(canvas, diagram.blocks, positions, sizes, padless);
  return canvas;
}
