import { labelLines, labelRowsOf, widestLabelLine } from "../../text/labels.js";
import { displayWidth, widestOf } from "../../text/width.js";
import { spanOf } from "../../canvas/extent.js";
import { chromeOf } from "../../graph/layout/boxes.js";
import type { Block, BlockLink } from "./model.js";
import {
  BORDERS,
  COL_GAP,
  GROUP_PAD,
  MARGIN,
  MIN_BLOCK_H,
  MIN_BLOCK_W,
  ROW_GAP,
  sizeOf,
  spanned,
  type Cell,
  type Grid,
  type Placed,
  type Sized,
} from "./metrics.js";

function layoutGrid(blocks: Block[], columns: number): Grid {
  const grid: Grid = [];
  let row: Cell[] = [];
  let col = 0;

  for (const block of blocks) {
    const span = Math.min(block.colSpan, columns);
    if (col + span > columns) {
      if (row.length > 0) grid.push(row);
      row = [];
      col = 0;
    }
    row.push([block, col, span]);
    col += span;
  }
  if (row.length > 0) grid.push(row);
  return grid;
}

// The width a composite's title asks for, with the same pad and walls as its grid.
const titleWidth = (group: Block): number => (group.label === "" ? 0 : displayWidth(group.label) + GROUP_PAD * 2 + BORDERS);

function blockSize(block: Block, paddingX: number, colGap: number): [number, number] {
  if (block.isSpace) return [MIN_BLOCK_W, MIN_BLOCK_H];

  if (block.children.length > 0) {
    const childSizes: Sized = new Map();
    computeAllSizes(block.children, childSizes, paddingX, colGap);
    const { colWidths, rowHeights } = sizedGrid(block.children, block.columns, childSizes, colGap);

    const innerW = spanOf(colWidths, colGap);
    const innerH = spanOf(rowHeights, ROW_GAP);
    const labelRows = block.label !== "" ? 1 : 0;
    return [
      Math.max(innerW + GROUP_PAD * 2 + BORDERS, titleWidth(block), MIN_BLOCK_W),
      Math.max(innerH + GROUP_PAD * 2 + BORDERS + labelRows, MIN_BLOCK_H),
    ];
  }

  const label = block.label || block.id;
  const lines = labelRowsOf(label);
  const widest = widestOf(lines);
  const shape = block.shape;
  // The padding counts the walls, so a padding squeezed under them still leaves them room beside the words.
  const chrome = chromeOf(shape, false);
  return [
    Math.max(widest + paddingX * 2 + chrome, widest + BORDERS + chrome, MIN_BLOCK_W),
    Math.max(lines.length + BORDERS, MIN_BLOCK_H),
  ];
}

export function computeAllSizes(blocks: Block[], sizes: Sized, paddingX: number, colGap: number): void {
  for (const block of blocks) {
    sizes.set(block.id, blockSize(block, paddingX, colGap));
    if (block.children.length > 0) computeAllSizes(block.children, sizes, paddingX, colGap);
  }
}

// The grid `blocks` are laid in, `declared` columns wide or as wide as their spans, and its track sizes.
export function sizedGrid(blocks: Block[], declared: number, sizes: Sized, colGap: number): { columns: number; grid: Grid; colWidths: number[]; rowHeights: number[] } {
  const columns = declared > 0 ? declared : spanned(blocks);
  const grid = layoutGrid(blocks, columns);
  const [colWidths, rowHeights] = gridDimensions(grid, columns, sizes, colGap);
  return { columns, grid, colWidths, rowHeights };
}

function gridDimensions(grid: Grid, colCount: number, sizes: Sized, colGap: number): [number[], number[]] {
  const colWidths = Array.from({ length: colCount }, () => MIN_BLOCK_W);
  const rowHeights = grid.map(() => MIN_BLOCK_H);

  grid.forEach((row, ri) => {
    for (const [block, startCol, span] of row) {
      const [w, h] = sizeOf(sizes, block.id);
      rowHeights[ri] = Math.max(rowHeights[ri], h);
      if (span === 1) colWidths[startCol] = Math.max(colWidths[startCol], w);
    }
  });

  for (const row of grid) {
    for (const [block, startCol, span] of row) {
      if (span <= 1) continue;
      const [w] = sizeOf(sizes, block.id);
      const available = spanOf(colWidths.slice(startCol, startCol + span), colGap);
      if (w <= available) continue;
      const extra = w - available;
      const perColumn = Math.floor(extra / span);
      const remainder = extra % span;
      for (let c = startCol; c < startCol + span; c++) {
        colWidths[c] = (colWidths[c]) + perColumn + (c - startCol < remainder ? 1 : 0);
      }
    }
  }

  return [colWidths, rowHeights];
}

function tracks(lengths: number[], start: number, gap: number | number[]): number[] {
  const at: number[] = [];
  let offset = start;
  lengths.forEach((length, index) => {
    at.push(offset);
    offset += length + (typeof gap === "number" ? gap : (gap[index] ?? COL_GAP));
  });
  return at;
}

export function columnGaps(grid: Grid, links: BlockLink[], count: number, gap: number): number[] {
  const gaps = Array.from({ length: Math.max(0, count - 1) }, () => gap);
  const seats = new Map<string, { row: number; start: number; span: number }>();
  grid.forEach((cells, row) => {
    for (const [block, start, span] of cells) seats.set(block.id, { row, start, span });
  });

  for (const link of links) {
    if (link.label === "") continue;
    const from = seats.get(link.source);
    const to = seats.get(link.target);
    if (from === undefined || to === undefined || from.row !== to.row) continue;
    const [left, right] = from.start < to.start ? [from, to] : [to, from];
    const after = left.start + left.span;
    if (after > right.start) continue;

    const crossed = right.start - after + 1;
    const each = Math.ceil((widestLabelLine(link.label) + 2) / crossed);
    for (let b = after - 1; b < right.start; b++) gaps[b] = Math.max(gaps[b], each);
  }
  return gaps;
}

// A label beside a link down the grid stands in the gap it crosses, which holds every row of it.
export function rowGaps(grid: Grid, links: BlockLink[]): number[] {
  const gaps = Array.from({ length: Math.max(0, grid.length - 1) }, () => ROW_GAP);
  const rows = new Map<string, number>();
  grid.forEach((cells, row) => {
    for (const [block] of cells) rows.set(block.id, row);
  });
  for (const link of links) {
    if (link.label === "") continue;
    const from = rows.get(link.source);
    const to = rows.get(link.target);
    if (from === undefined || to === undefined || from === to) continue;
    for (let b = Math.min(from, to); b < Math.max(from, to); b++) gaps[b] = Math.max(gaps[b], labelLines(link.label));
  }
  return gaps;
}

export function computePositions(
  grid: Grid,
  colWidths: number[],
  rowHeights: number[],
  sizes: Sized,
  positions: Placed,
  colGap: number,
  colGaps: number[],
  rowGapsOf: number[]
): void {
  const colX = tracks(colWidths, MARGIN, colGaps);
  const rowY = tracks(rowHeights, MARGIN, rowGapsOf);

  grid.forEach((row, ri) => {
    for (const [block, startCol, span] of row) {
      const x = colX[startCol];
      const y = rowY[ri];

      const endCol = Math.min(startCol + span - 1, colWidths.length - 1);
      const w = span > 1 ? (colX[endCol]) + (colWidths[endCol]) - x : (colWidths[startCol]);
      const h = rowHeights[ri];
      sizes.set(block.id, [w, h]);
      positions.set(block.id, [x, y]);

      if (block.children.length > 0) positionChildren(block, x, y, sizes, positions, colGap);
    }
  });
}

function positionChildren(group: Block, gx: number, gy: number, sizes: Sized, positions: Placed, colGap: number): void {
  const labelRows = group.label !== "" ? 1 : 0;
  const { grid: innerGrid, colWidths, rowHeights } = sizedGrid(group.children, group.columns, sizes, colGap);

  // A grid narrower than the title that widened its frame stands in the middle of it.
  const aside = Math.max(0, Math.floor((titleWidth(group) - spanOf(colWidths, colGap) - GROUP_PAD * 2 - BORDERS) / 2));
  const colX = tracks(colWidths, gx + GROUP_PAD + 1 + aside, colGap);
  const rowY = tracks(rowHeights, gy + GROUP_PAD + 1 + labelRows, ROW_GAP);

  innerGrid.forEach((row, ri) => {
    for (const [block, startCol, span] of row) {
      const x = colX[startCol];
      const y = rowY[ri];
      const endCol = startCol + span - 1;
      const w = span > 1 && endCol < colWidths.length ? (colX[endCol]) + (colWidths[endCol]) - x : (colWidths[startCol]);
      sizes.set(block.id, [w, rowHeights[ri]]);
      positions.set(block.id, [x, y]);
      if (block.children.length > 0) positionChildren(block, x, y, sizes, positions, colGap);
    }
  });
}

