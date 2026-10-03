import { Canvas } from "../../canvas/canvas.js";

import {ARROWHEADS, onAnEdge, type PlacedLabel } from "../../canvas/cells.js";
import { putEdgeLabel } from "./glyphs.js";

import { SUBGRAPH as STYLE_SUBGRAPH } from "../../canvas/keys.js";
import { truncateToWidth } from "../../text/width.js";
import { LITERAL_NEWLINE, labelLines, labelRowsOf, widestLabelLine } from "../../text/labels.js";

export const LABEL_SEARCH = 4;

const LABEL_BREATH = 1;

export const labelOverlaps = (row: number, col: number, colEnd: number, placed: PlacedLabel[], height = 1): boolean =>
  placed.some(([r, c, e]) => r >= row && r < row + height && col <= e + LABEL_BREATH && c <= colEnd + LABEL_BREATH);

export const HOME = 0;

const CLUSTER = 1;

const FRAME = 2;

export const REACHES = [HOME, CLUSTER, FRAME] as const;

export type Reach = (typeof REACHES)[number];

export type Foreign = (row: number, col: number) => boolean;

export const ON_THE_PAGE: Foreign = () => false;

export const blocksLabel = (canvas: Canvas, row: number, col: number, reach: Reach = HOME, foreign: Foreign = ON_THE_PAGE): boolean => {
  if (canvas.isProtected(row, col)) return true;
  if (reach === HOME && foreign(row, col)) return true;
  const mark = canvas.get(row, col);
  if (ARROWHEADS.has(mark)) return true;
  if (mark.trim() === "") return false;
  const style = canvas.getStyle(row, col);
  return onAnEdge(style) || (reach !== FRAME && style.startsWith(STYLE_SUBGRAPH));
};

// A label of several rows stands in the block as wide as its widest row, every cell of it free.
export function labelFits(canvas: Canvas, row: number, col: number, label: string, reach: Reach = HOME, foreign: Foreign = ON_THE_PAGE): boolean {
  if (row < 0 || col < 0) return false;
  const end = Math.min(col + widestLabelLine(label), canvas.width);
  for (let r = row; r < Math.min(row + labelLines(label), canvas.height); r++) {
    for (let c = col; c < end; c++) if (blocksLabel(canvas, r, c, reach, foreign)) return false;
  }
  return true;
}

export function fittedLabel(canvas: Canvas, row: number, col: number, label: string): string {
  if (labelFits(canvas, row, col, label, FRAME)) return label;
  const freeFrom = (r: number): number => {
    let free = 0;
    while (col + free < canvas.width && r < canvas.height && !blocksLabel(canvas, r, col + free, FRAME)) free++;
    return r < canvas.height ? free : Number.POSITIVE_INFINITY;
  };
  let free = Number.POSITIVE_INFINITY;
  for (let r = row; r < row + labelLines(label); r++) free = Math.min(free, freeFrom(r));
  if (free <= 1) return "";
  return labelRowsOf(label).map((line) => truncateToWidth(line, free)).join(LITERAL_NEWLINE);
}

export function tryPlaceLabel(
  canvas: Canvas,
  row: number,
  col: number,
  label: string,
  placed: PlacedLabel[],
  key: string,
  reach: Reach = HOME,
  foreign: Foreign = ON_THE_PAGE
): boolean {
  if (col < 0 || row < 0) return false;
  const colEnd = col + widestLabelLine(label);
  const height = labelLines(label);
  if (labelOverlaps(row, col, colEnd, placed, height)) return false;
  if (!labelFits(canvas, row, col, label, reach, foreign)) return false;
  canvas.resize(colEnd + 1, row + height);
  seatLabel(canvas, row, col, label, key, placed);
  return true;
}

// Writes the label from its block's top left and books every row of it.
export function seatLabel(canvas: Canvas, row: number, col: number, label: string, key: string, placed: PlacedLabel[]): void {
  putEdgeLabel(canvas, row, col, label, key);
  const colEnd = col + widestLabelLine(label);
  for (let r = row; r < row + labelLines(label); r++) placed.push([r, col, colEnd]);
}

export function findLastTurn(path: Array<[number, number]>): number {
  for (let i = path.length - 2; i > 0; i--) {
    const prev = path[i - 1];
    const current = path[i];
    const next = path[i + 1];
    const dxIn = current[0] - prev[0];
    const dyIn = current[1] - prev[1];
    const dxOut = next[0] - current[0];
    const dyOut = next[1] - current[1];
    if ((dxIn === 0 && dyIn === 0) || (dxOut === 0 && dyOut === 0)) continue;
    if (Math.sign(dxIn) !== Math.sign(dxOut) || Math.sign(dyIn) !== Math.sign(dyOut)) return i;
  }
  return -1;
}
