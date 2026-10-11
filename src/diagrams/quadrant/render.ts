import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import type { QuadrantChart } from "./model.js";
import { centredOn, centredOnSpan, displayWidth, glyphsOf, isWideGlyph, truncateToWidth } from "../../text/width.js";
import { Canvas } from "../../canvas/canvas.js";
import { SPACE } from "../../text/chars.js";
import {
  INK_MARK, QUADRANT_AXIS, QUADRANT_BORDER, QUADRANT_FILL, QUADRANT_POINT, QUADRANT_POINT_TEXT, QUADRANT_TEXT, QUADRANT_TITLE, QUADRANT_X_LABEL,
  QUADRANT_Y_LABEL, indexed,
} from "../../canvas/keys.js";
import { cornersOf } from "../../canvas/corners.js";
import { frame } from "../../canvas/shape-frame.js";
import { SHADOW } from "../../canvas/merge.js";
import { titleLines } from "../../text/labels.js";
import { foldedTitle, putSeated, titledAbove } from "../@common/titled.js";

const FULL_W = 60;
// The narrowest plot a budget shrinks it to: each quadrant keeps a dozen cells for its name.
const MIN_CHART_W = 26;
const CHART_H = 20;
const MARGIN_L = 2;

const FRAME = 1;

// What a chart cell holds, each painted in the quadrant it stands in: a quadrant's name, a point, a point's label.
const enum Role {
  Ground,
  Name,
  Point,
  PointLabel,
}
const ROLE_KEYS: Readonly<Record<Role, string>> = {
  [Role.Ground]: QUADRANT_FILL,
  [Role.Name]: QUADRANT_TEXT,
  [Role.Point]: QUADRANT_POINT,
  [Role.PointLabel]: QUADRANT_POINT_TEXT,
};

export function renderQuadrant(diagram: QuadrantChart, cs: CharSet = UNICODE, budget?: number): Canvas {
  const chartW = budget === undefined ? FULL_W : Math.max(MIN_CHART_W, Math.min(FULL_W, budget - MARGIN_L - FRAME));
  const room = Math.max(MARGIN_L + chartW + FRAME, budget ?? 0);
  const horizontal = cs.horizontal;
  const vertical = cs.vertical;
  const cross = cs.cross;
  const marker = cs.point;

  const halfW = Math.floor(chartW / 2);
  const halfH = Math.floor(CHART_H / 2);

  const grid: string[][] = Array.from({ length: CHART_H }, () => Array.from({ length: chartW }, () => SPACE));
  const roles: Role[][] = Array.from({ length: CHART_H }, () => Array.from({ length: chartW }, () => Role.Ground));
  const inks: Array<Array<string | undefined>> = Array.from({ length: CHART_H }, () => Array.from({ length: chartW }, () => undefined));

  for (let c = 0; c < chartW; c++) grid[halfH][c] = horizontal;
  for (let r = 0; r < CHART_H; r++) grid[r][halfW] = vertical;
  grid[halfH][halfW] = cross;

  const cells = diagram.points.map((point) => ({
    point,
    px: Math.min(chartW - 1, Math.max(0, Math.trunc(point.x * (chartW - 1)))),
    py: Math.min(CHART_H - 1, Math.max(0, Math.trunc((1 - point.y) * (CHART_H - 1)))),
  }));
  // Every marker lands before any label, so no label covers a point.
  for (const { point, px, py } of cells) {
    grid[py][px] = marker;
    roles[py][px] = Role.Point;
    inks[py][px] = point.color;
  }
  const upperRows = [0, halfH] as const;
  const lowerRows = [halfH + 1, CHART_H] as const;
  // A name keeps a cell clear of the axis and of the frame on each side.
  const leftRoom = halfW - 2;
  const rightRoom = chartW - halfW - 3;
  const rightCentre = halfW + 1 + Math.floor((chartW - halfW - 1) / 2);
  placeLabel(grid, roles, diagram.quadrant2, Math.floor(halfW / 2), Math.floor(halfH / 2), upperRows, leftRoom);
  placeLabel(grid, roles, diagram.quadrant1, rightCentre, Math.floor(halfH / 2), upperRows, rightRoom);
  placeLabel(grid, roles, diagram.quadrant3, Math.floor(halfW / 2), halfH + Math.floor(halfH / 2), lowerRows, leftRoom);
  placeLabel(grid, roles, diagram.quadrant4, rightCentre, halfH + Math.floor(halfH / 2), lowerRows, rightRoom);
  const axisGlyphs = new Set([horizontal, vertical, cross]);
  const open = (row: number, col: number): boolean => roles[row][col] === Role.Ground && (grid[row][col] === SPACE || axisGlyphs.has(grid[row][col]));
  // A label's own cells clear, and the one past its end too, so it never runs into another text.
  const free = (row: number, start: number, text: string): boolean => {
    const end = start + displayWidth(text);
    return start >= 0 && end <= chartW && cellsOf(text).every((_, i) => open(row, start + i)) && (end === chartW || roles[row][end] !== Role.Name);
  };
  for (const { point, px, py } of cells) {
    const label = SPACE + point.label;
    const [row, start, text] = labelSpot(label, px, py, free) ?? besidePoint(label, px, py, chartW);
    cellsAt(start, text, (x) => x >= 0 && x < chartW && roles[row][x] !== Role.Point).forEach(([x, ch]) => {
      grid[row][x] = ch;
      roles[row][x] = Role.PointLabel;
      inks[row][x] = undefined;
    });
  }

  // mermaid's quadrant 1 is the top right one, 2 the top left, 3 the bottom left, 4 the bottom right.
  const quadrantAt = (r: number, c: number): number => (r < halfH ? (c < halfW ? 2 : 1) : c < halfW ? 3 : 4);
  const styles: string[][] = Array.from({ length: CHART_H }, (_, r) =>
    Array.from({ length: chartW }, (_, c) => {
      const key = indexed(ROLE_KEYS[roles[r][c]], quadrantAt(r, c));
      const ink = inks[r][c];
      return ink === undefined ? key : key + INK_MARK + ink;
    })
  );
  // A text laid over an axis keeps its own paint.
  for (let c = 0; c < chartW; c++) if (roles[halfH][c] === Role.Ground) styles[halfH][c] = QUADRANT_AXIS;
  for (let r = 0; r < CHART_H; r++) if (roles[r][halfW] === Role.Ground) styles[r][halfW] = QUADRANT_AXIS;

  const xLabelLines = diagram.xLabel === "" ? [] : foldedTitle(diagram.xLabel, budget, MARGIN_L + chartW + FRAME);
  const yLabelLines = diagram.yLabel === "" ? [] : titleLines(diagram.yLabel, Math.max(1, room - 2)).map((line, i) => `${i === 0 ? cs.axisUp : SPACE} ${line}`);
  // mermaid moves the x axis to the bottom once a point is plotted, whatever `xAxisPosition` says.
  const xOnTop = xLabelLines.length > 0 && diagram.xAxisTop && diagram.points.length === 0;
  const xRowsAbove = xOnTop ? xLabelLines.length : 0;
  const yRows = yLabelLines.length;
  const xRowsBelow = xLabelLines.length > 0 && !xOnTop ? 1 + xLabelLines.length : 0;

  const height = yRows + xRowsAbove + FRAME + CHART_H + FRAME + xRowsBelow;
  const wide = Math.max(MARGIN_L + chartW + 1, ...[...xLabelLines, ...yLabelLines].map(displayWidth));
  const canvas = new Canvas(wide, height);
  const xSeat = { key: QUADRANT_X_LABEL, left: undefined, over: [MARGIN_L, chartW] as const };
  // On the right, the y axis's lines end on the frame's right edge.
  yLabelLines.forEach((line, r) => {
    const at = diagram.yAxisRight ? Math.max(0, MARGIN_L + chartW + 1 - displayWidth(line)) : 0;
    canvas.putText(r, at, line, QUADRANT_Y_LABEL);
  });
  if (xOnTop) putSeated(canvas, yRows, xLabelLines, xSeat, wide);

  const top = yRows + xRowsAbove;

  for (let r = 0; r < CHART_H; r++) {
    for (let c = 0; c < chartW; c++) {
      const row = top + FRAME + r;
      const col = MARGIN_L + c;
      const ch = grid[r][c];
      const style = styles[r][c];
      // A wide glyph parted from its shadow by a later text shows blank rather than spilling over its neighbour.
      if (isWideGlyph(ch) && grid[r][c + 1] === SHADOW) canvas.putText(row, col, ch, style);
      else if (ch === SPACE || ch === SHADOW || isWideGlyph(ch)) canvas.setStyle(row, col, style);
      else canvas.put(row, col, ch, false, style);
    }
  }

  drawFrame(canvas, top, chartW, halfW, halfH, cs);

  if (!xOnTop) putSeated(canvas, top + FRAME + CHART_H + FRAME + 1, xLabelLines, xSeat, wide);

  return titledAbove(canvas, diagram.title, { key: QUADRANT_TITLE, left: undefined, budget, over: [0, MARGIN_L + chartW] });
}

function drawFrame(canvas: Canvas, top: number, chartW: number, halfW: number, halfH: number, cs: CharSet): void {
  const left = MARGIN_L - FRAME;
  const right = MARGIN_L + chartW;
  const lower = top + FRAME + CHART_H;
  const axisRow = top + FRAME + halfH;
  const axisCol = MARGIN_L + halfW;
  frame(canvas, left, top, right - left + 1, lower - top + 1, cs, QUADRANT_BORDER, cornersOf(cs, false));
  // The axes meet the frame in tees, merged over its rules.
  canvas.put(top, axisCol, cs.teeDown, true, QUADRANT_BORDER);
  canvas.put(lower, axisCol, cs.teeUp, true, QUADRANT_BORDER);
  canvas.put(axisRow, left, cs.teeRight, true, QUADRANT_BORDER);
  canvas.put(axisRow, right, cs.teeLeft, true, QUADRANT_BORDER);
}

type Spot = readonly [row: number, start: number, text: string];

// Where a point's label lands clear of every other text and point: beside it on its row, right then left, else
// centred on the nearest row above or below, as mermaid writes a label under its point.
function labelSpot(label: string, px: number, py: number, free: (row: number, start: number, text: string) => boolean): Spot | undefined {
  const width = displayWidth(label);
  const leftward = label.trimStart() + SPACE;
  const beside: Spot[] = [[py, px + 1, label], [py, px - width, leftward]];
  const around = Array.from({ length: CHART_H - 1 }, (_, i) => py + (i % 2 === 0 ? 1 : -1) * (Math.floor(i / 2) + 1))
    .filter((row) => row >= 0 && row < CHART_H)
    .map((row): Spot => [row, centredOnSpan(px, width), label]);
  return [...beside, ...around].find(([row, start, text]) => free(row, start, text));
}

// No clear room: on its row, on the wider side of the point, cut to that side's room.
function besidePoint(label: string, px: number, py: number, chartW: number): Spot {
  const right = chartW - px - 1;
  if (right >= px) return [py, px + 1, truncateToWidth(label, right)];
  const text = truncateToWidth(label.trimStart(), px - 1) + SPACE;
  return [py, px - displayWidth(text), text];
}

// A quadrant's name centred in it, folded on words to the quadrant's room, moved to the nearest rows of its quadrant
// no point stands on.
function placeLabel(grid: string[][], roles: Role[][], label: string, cx: number, centre: number, rows: readonly [number, number], room: number): void {
  const lines = titleLines(label, Math.max(1, room));
  const width = grid.length > 0 ? grid[0].length : 0;
  const startOf = (line: string): number => centredOn(cx, line);
  const clear = (top: number): boolean =>
    lines.every((line, r) => Array.from({ length: displayWidth(line) + 2 }, (_, i) => roles[top + r]?.[startOf(line) - 1 + i] !== Role.Point).every(Boolean));
  const first = centre - Math.floor((lines.length - 1) / 2);
  const tried = Array.from({ length: 2 * (rows[1] - rows[0]) }, (_, i) => first + (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2));
  const fits = (top: number): boolean => top >= rows[0] && top + lines.length <= rows[1];
  const cy = tried.find((top) => fits(top) && clear(top)) ?? (fits(first) ? first : rows[0]);
  lines.forEach((line, r) => {
    const row = cy + r;
    if (row < 0 || row >= grid.length) return;
    cellsAt(startOf(line), line, (x) => x >= 0 && x < width).forEach(([x, ch]) => {
      grid[row][x] = ch;
      roles[row][x] = Role.Name;
    });
  });
}

// A text's cells as the canvas lays them, a wide glyph's second one held by its shadow.
const cellsOf = (text: string): string[] => glyphsOf(text).flatMap((glyph) => (isWideGlyph(glyph) ? [glyph, SHADOW] : [glyph]));

// The cells of a text laid from `start` that `open` lets it take.
const cellsAt = (start: number, text: string, open: (x: number) => boolean): Array<readonly [number, string]> =>
  cellsOf(text).flatMap((cell, i): Array<readonly [number, string]> => (open(start + i) ? [[start + i, cell]] : []));

