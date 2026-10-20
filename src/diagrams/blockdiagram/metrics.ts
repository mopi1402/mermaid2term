import { BLOCK_PADDING_CELLS } from "../../source/source.js";
import type { Block } from "./model.js";

export const BLOCK_PAD = BLOCK_PADDING_CELLS;
export const MIN_BLOCK_W = 12;
export const MIN_BLOCK_H = 5;
export const COL_GAP = 4;
export const ROW_GAP = 2;
export const MARGIN = 2;
export const GROUP_PAD = 2;
export const BORDERS = 2;
// Far past what a terminal shows, they keep an absurd column count or padding from filling memory.
export const MAX_COLUMNS = 100;
export const MAX_BLOCK_PAD = 100;

export const MIN_CANVAS_W = 20;
export const MIN_CANVAS_H = 5;

export type Cell = readonly [Block, number, number];
export type Grid = Cell[][];

export type Sized = Map<string, [number, number]>;
export type Placed = Map<string, [number, number]>;

export const sizeOf = (sizes: Sized, id: string): [number, number] => sizes.get(id) ?? [MIN_BLOCK_W, MIN_BLOCK_H];

export const spanned = (blocks: Block[]): number => blocks.reduce((total, block) => total + block.colSpan, 0);
