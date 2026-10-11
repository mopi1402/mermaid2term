import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import type { XYChart } from "./model.js";
import { centredAt, centredOn, displayWidth, firstFitting, truncateToWidth, widestOf } from "../../text/width.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { XY_DATA_LABEL, XY_TITLE, XY_X_AXIS, XY_Y_AXIS } from "../../canvas/keys.js";
import { eighthsRun } from "../../canvas/geometry.js";
import { DOTS_ACROSS, DOTS_DOWN, dotsAcross, dotsDown } from "../../canvas/braille.js";
import { LOWER_EIGHTHS } from "../../canvas/alphabet.js";
import { putBarRun } from "../../canvas/bar-run.js";
import { SPACE } from "../../text/chars.js";
import { blockOf, foldedTitle, putSeated, titledAbove } from "../@common/titled.js";
import { blankColumns, inkedWidth } from "../../canvas/extent.js";
import { cellAt, categoryMarks, clearOf, dotAt, drawAxes, paddedOf, putTick, reachOf, shownLine, thinnedTicks, tickCell } from "./axes.js";
import { CHART_W, columnOf, horizontalRooms, laidOut, plotFloor, verticalRooms, type Room } from "./rooms.js";
import { linesOn, onBarStyle, plotStyle } from "./lines.js";
import { drawLegend, pointLabels, writeAsides, type Aside } from "./asides.js";

// The arrow and the blank before a value axis name.
const AXIS_LEAD = 2;
const CHART_H = 15;
const BAR_GAP = 2;
const MARGIN_L = 8;
// Two value labels down the side keep a blank row between them, two marks down a horizontal chart's side too.
const TICK_ROWS_APART = 2;
const LEGEND_GAP = 2;
const POINT_LABEL_GAP = 2;

export function renderXYChart(diagram: XYChart, cs: CharSet = UNICODE, rounded = true, budget?: number): Canvas {
  if (diagram.datasets.length === 0) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);
  const { canvas, over, footRow } = headed(fitted(diagram, cs, rounded, budget), diagram, diagram.horizontal ? cs.axisRight : cs.axisUp, budget);
  if (over === undefined) return canvas;
  writeFoot(canvas, xTitle(diagram), footRow, over, budget);
  return titledAbove(canvas, shownTitle(diagram), { key: XY_TITLE, left: undefined, budget, over });
}

// A chart drawn, with the span of columns its title and its x axis's title centre over, and the row of the latter.
interface Charted {
  readonly canvas: Canvas;
  readonly over: readonly [left: number, width: number] | undefined;
  readonly footRow: number;
}

const drawnWidth = (canvas: Canvas): number => inkedWidth(canvas) - blankColumns(canvas);

// The chart in its own room, or in the first of ever tighter rooms that holds it within the budget, the tightest
// where none does.
function fitted(diagram: XYChart, cs: CharSet, rounded: boolean, budget: number | undefined): Charted {
  const draw = (room?: Room): Charted => (diagram.horizontal ? renderHorizontal(diagram, cs, rounded, room) : renderVertical(diagram, cs, rounded, room));
  // The value axis's name, written at column 0 once fitted, holds the blank columns left of the chart.
  const measure = (charted: Charted): number => (yTitle(diagram) === "" ? drawnWidth(charted.canvas) : inkedWidth(charted.canvas));
  const natural = draw();
  const laid = laidOut(diagram);
  if (budget === undefined || laid === undefined || measure(natural) <= budget) return natural;
  const rooms = diagram.horizontal ? horizontalRooms(diagram, laid) : verticalRooms(laid);
  return firstFitting(rooms, draw, measure, budget) ?? natural;
}

// The x axis's title under the plot, held whole while the chart or the budget allows, folded on words past it.
function writeFoot(canvas: Canvas, text: string, row: number, [left, width]: readonly [number, number], budget: number | undefined): void {
  if (text === "") return;
  const drawn = inkedWidth(canvas);
  const lines = foldedTitle(text, budget, drawn);
  const block = blockOf(lines);
  canvas.resize(block, row + lines.length + 1);
  putSeated(canvas, row, lines, { key: XY_X_AXIS.title, left: undefined, over: [left + 1, width] }, Math.max(drawn, block));
}

const shownTitle = (diagram: XYChart): string => (diagram.showTitle ? diagram.title : "");

const yTitle = (diagram: XYChart): string => (diagram.yShown.title ? diagram.yLabel : "");

// The rows above the plot: one for the value axis's name, written once the chart is fitted, then `spare`.
const headRowsOf = (diagram: XYChart, spare = 0): number => (yTitle(diagram) === "" ? 0 : 1) + spare;

// The value axis's name behind its arrow over the plot, held whole while the chart or the budget allows, folded on
// words past it, as quadrant folds its own.
function headed(charted: Charted, diagram: XYChart, arrow: string, budget: number | undefined): Charted {
  const title = yTitle(diagram);
  if (title === "") return charted;
  const { canvas } = charted;
  const lines = foldedTitle(title, budget, inkedWidth(canvas), AXIS_LEAD).map((line, i) => `${i === 0 ? arrow : SPACE} ${line}`);
  const extra = lines.length - 1;
  const grown = new Canvas(Math.max(canvas.width, blockOf(lines)), canvas.height + extra);
  grown.stamp(canvas, extra, 0);
  lines.forEach((line, row) => grown.putText(row, 0, line, XY_Y_AXIS.title));
  return { canvas: grown, over: charted.over, footRow: charted.footRow + extra };
}

const xTitle = (diagram: XYChart): string => (diagram.xShown.title ? diagram.xLabel : "");

// A value written on or beside its bar: mermaid's `showDataLabel`, outside the bar under `showDataLabelOutsideBar`.
const dataLabelled = (diagram: XYChart): boolean => diagram.showDataLabel && diagram.datasets.some((ds) => ds.chartType === "bar");

const labelled = (diagram: XYChart): boolean =>
  diagram.datasets.some((ds) => ds.chartType === "line" && ds.pointLabels.some((label) => label !== ""));

function renderVertical(diagram: XYChart, cs: CharSet, rounded: boolean, room?: Room): Charted {
  const barChar = cs.barFull;

  const laid = laidOut(diagram);
  if (laid === undefined) return { canvas: new Canvas(EMPTY_SIZE, EMPTY_SIZE), over: undefined, footRow: 0 };
  const { low, high, span, points, categoryWidth } = laid;
  const columnWidth = room?.span ?? columnOf(categoryWidth);
  const gap = room?.gap ?? BAR_GAP;
  const categories = laid.categories.map((category) => truncateToWidth(category, room?.label ?? categoryWidth));
  const { xShown, yShown } = diagram;
  const reach = (value: number): number => reachOf(value, low, span, CHART_H);
  const rows = paddedOf(CHART_H);
  const valueTicks = thinnedTicks(low, high, (a, b) => Math.abs(tickCell(reach(b)) - tickCell(reach(a))) >= TICK_ROWS_APART);
  const labels = yShown.label ? valueTicks.map(String) : [];
  // The value labels end one blank short of the axis, however wide the widest.
  const left = labels.length === 0 ? 0 : Math.max(MARGIN_L, widestOf(labels) + 1);
  const outside = dataLabelled(diagram) && diagram.dataLabelOutside;

  const chartWidth = points * (columnWidth + gap) - gap;
  // A point's label, or a value over its bar, sits on the row over it, one more row where it stands on the plot's top.
  const headRows = headRowsOf(diagram, labelled(diagram) || outside ? 1 : 0);
  const canvas = new Canvas(left + 1 + chartWidth + 2 + 1, rows + 4 + headRows + 1);

  const axisRow = drawAxes(canvas, cs, left, headRows, rows, chartWidth, shownLine(yShown, XY_Y_AXIS), shownLine(xShown, XY_X_AXIS));
  valueTicks.forEach((tick, i) => {
    const row = headRows + rows - 1 - tickCell(reach(tick));
    const label = labels[i];
    if (label !== undefined) canvas.putText(row, left - displayWidth(label) - 1, label, XY_Y_AXIS.label);
    // The foot's tick is the corner the two axes meet on.
    if (row !== axisRow) putTick(canvas, row, left, yShown, cs.teeLeft, cs.horizontal, XY_Y_AXIS.tick);
  });

  const plotLine = linesOn(canvas, cs, rounded, false);
  const columnLeftOf = (i: number): number => left + 1 + i * (columnWidth + gap);
  const foot = dotsDown(headRows + rows) - 1;
  const asides: Aside[] = [];

  diagram.datasets.forEach((ds, plot) => {
    const style = plotStyle(plot);
    const values = ds.values.slice(0, points);
    if (ds.chartType === "line") {
      const cells = values.map((value, i) => ({ row: headRows + rows - 1 - cellAt(reach(value)), col: columnLeftOf(i) + Math.floor(columnWidth / 2) }));
      const dots = values.map((value, i) => ({ x: dotsAcross(columnLeftOf(i)) + columnWidth, y: foot - dotAt(reach(value), DOTS_DOWN, rows) }));
      const points = plotLine(cells, dots, plot);
      asides.push(...pointLabels(ds.pointLabels, points, style, (cell, text) => {
        const col = centredOn(cell.col, text);
        return [{ row: cell.row - 1, col }, { row: cell.row + 1, col }];
      }));
      return;
    }
    values.forEach((value, i) => {
      const columnLeft = columnLeftOf(i);
      const { whole: bars, eighths } = eighthsRun(reach(value));
      const half = eighths > 0 && bars < rows;
      for (let r = 0; r < bars + (half ? 1 : 0); r++) {
        const row = headRows + rows - 1 - r;
        // A top leaves the rest of its cell to an earlier bar there.
        const styleAt = (col: number): string => (r < bars ? style : onBarStyle(canvas, cs, row, col, plot, "top"));
        const glyph = r < bars ? barChar : LOWER_EIGHTHS[eighths - 1];
        for (let c = 0; c < columnWidth; c++) canvas.put(row, columnLeft + c, glyph, false, styleAt(columnLeft + c));
      }
      // mermaid hangs the value from the bar's top edge, inside it, or over it when told to keep it outside.
      const text = String(value);
      if (!diagram.showDataLabel || displayWidth(text) > columnWidth) return;
      const col = columnLeft + centredAt(columnWidth, text);
      if (outside) asides.push({ row: headRows + rows - 1 - bars - (half ? 1 : 0), col, text, style: XY_DATA_LABEL });
      else if (bars >= 1) asides.push({ row: headRows + rows - bars, col, text, style: XY_DATA_LABEL });
    });
  });

  for (const { at, text } of categoryMarks(laid, categories, (i) => columnLeftOf(i) + Math.floor(columnWidth / 2), clearOf)) {
    putTick(canvas, axisRow, at, xShown, cs.teeDown, cs.vertical, XY_X_AXIS.tick);
    if (xShown.label) canvas.putText(axisRow + 1, Math.max(0, centredOn(at, text)), text, XY_X_AXIS.label);
  }

  const asideEnd = writeAsides(canvas, asides);
  drawLegend(canvas, diagram, cs, Math.max(left + 1 + chartWidth, asideEnd) + LEGEND_GAP, headRows, rows);
  return { canvas, over: [left, chartWidth], footRow: axisRow + (xShown.label ? 2 : 1) };
}

function renderHorizontal(diagram: XYChart, cs: CharSet, rounded: boolean, room?: Room): Charted {
  const barChar = cs.barFull;

  const laid = laidOut(diagram);
  if (laid === undefined) return { canvas: new Canvas(EMPTY_SIZE, EMPTY_SIZE), over: undefined, footRow: 0 };
  const { low, high, span, points } = laid;
  const { xShown, yShown } = diagram;
  const categoryWidth = room?.label ?? laid.categoryWidth;
  const categories = laid.categories.map((category) => truncateToWidth(category, categoryWidth));
  const marginLeft = categoryWidth + 2;
  const scale = room?.span ?? Math.max(CHART_W, plotFloor(diagram, laid));
  const plotWidth = paddedOf(scale);
  const reach = (value: number): number => reachOf(value, low, span, scale);
  // A tick stands on the cell a bar of its value ends half way through, a point of it drawn on; the lowest is the corner.
  const colOf = (tick: number): number => marginLeft + 1 + tickCell(reach(tick));
  const valueTicks = thinnedTicks(low, high, (a, b) => clearOf({ at: colOf(a), text: String(a) }, { at: colOf(b), text: String(b) }));
  const labels = yShown.label ? valueTicks.map(String) : [];
  const overhang = Math.max(3, Math.ceil(widestOf(labels) / 2) + 1);
  const outside = dataLabelled(diagram) && diagram.dataLabelOutside;

  const chartHeight = points * 2 - 1;
  const headRows = headRowsOf(diagram);
  const canvas = new Canvas(marginLeft + 1 + plotWidth + overhang, headRows + chartHeight + 3 + 1);

  const axisRow = drawAxes(canvas, cs, marginLeft, headRows, chartHeight, plotWidth, shownLine(xShown, XY_X_AXIS), shownLine(yShown, XY_Y_AXIS));

  valueTicks.forEach((tick, i) => {
    const col = colOf(tick);
    if (col !== marginLeft) putTick(canvas, axisRow, col, yShown, cs.teeDown, cs.vertical, XY_Y_AXIS.tick);
    const label = labels[i];
    if (label !== undefined) canvas.putText(axisRow + 1, Math.max(0, centredOn(col, label)), label, XY_Y_AXIS.label);
  });
  if (xShown.label) {
    for (const { at, text } of categoryMarks(laid, categories, (i) => headRows + i * 2, (a, b) => Math.abs(b.at - a.at) >= TICK_ROWS_APART)) {
      canvas.putText(at, Math.max(0, marginLeft - displayWidth(text) - 1), text, XY_X_AXIS.label);
    }
  }

  const plotLine = linesOn(canvas, cs, rounded, true);
  const asides: Aside[] = [];

  diagram.datasets.forEach((ds, plot) => {
    const style = plotStyle(plot);
    const values = ds.values.slice(0, points);
    if (ds.chartType === "line") {
      const cells = values.map((value, i) => ({ row: headRows + i * 2, col: marginLeft + 1 + cellAt(reach(value)) }));
      const dots = values.map((value, i) => ({ x: dotsAcross(marginLeft + 1) + dotAt(reach(value), DOTS_ACROSS, plotWidth), y: dotsDown(headRows + i * 2) + 1 }));
      const points = plotLine(cells, dots, plot);
      asides.push(...pointLabels(ds.pointLabels, points, style, (cell, text) => [
        { row: cell.row, col: cell.col + POINT_LABEL_GAP },
        { row: cell.row, col: cell.col - POINT_LABEL_GAP - displayWidth(text) + 1 },
      ]));
      return;
    }
    values.forEach((value, i) => {
      const row = headRows + i * 2;
      const exact = Math.min(plotWidth, reach(value));
      const { whole, eighths } = eighthsRun(exact);
      const tipStyle = onBarStyle(canvas, cs, row, marginLeft + 1 + whole, plot, "top");
      const drawn = putBarRun(canvas, row, marginLeft + 1, exact, barChar, style);
      // A top leaves the rest of its cell to an earlier bar there.
      if (eighths > 0) canvas.setStyle(row, marginLeft + 1 + whole, tipStyle);
      // mermaid ends the value just inside the bar's far end, or starts it one blank past it when told to.
      const text = String(value);
      if (!diagram.showDataLabel) return;
      if (outside) asides.push({ row, col: marginLeft + 1 + drawn + 1, text, style: XY_DATA_LABEL });
      else if (whole >= displayWidth(text) + 1) asides.push({ row, col: marginLeft + 1 + whole - displayWidth(text), text, style: XY_DATA_LABEL });
    });
  });

  const asideEnd = writeAsides(canvas, asides);
  drawLegend(canvas, diagram, cs, Math.max(marginLeft + 1 + plotWidth, asideEnd) + LEGEND_GAP, headRows, chartHeight);
  return { canvas, over: [marginLeft, plotWidth], footRow: axisRow + (labels.length > 0 ? 2 : 1) };
}
