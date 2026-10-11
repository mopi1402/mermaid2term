import { type CharSet } from "../../canvas/model.js";
import type { XYChart } from "./model.js";
import { centredOffset, displayWidth } from "../../text/width.js";
import type { Canvas } from "../../canvas/canvas.js";
import { XY_LEGEND } from "../../canvas/keys.js";
import { rectFree } from "../../canvas/cells.js";
import { plotStyle, type Cell } from "./lines.js";

// A text laid over the plots once they are all down: a point's label, a bar's value; at the first of its places
// where it covers no ink, at its own where none is free.
export interface Aside extends Cell {
  text: string;
  style: string;
  elsewhere?: readonly Cell[];
}

export const pointLabels = (labels: string[], cells: Cell[], style: string, at: (cell: Cell, text: string) => readonly [Cell, ...Cell[]]): Aside[] =>
  cells.flatMap((cell, i) => {
    const text = labels[i] ?? "";
    if (text === "") return [];
    const [own, ...elsewhere] = at(cell, text);
    return [{ ...own, text, style, elsewhere }];
  });

const coversNoInk = (canvas: Canvas, { row, col }: Cell, text: string): boolean =>
  col >= 0 && row >= 0 && row < canvas.height && rectFree(canvas, row, col, 1, displayWidth(text));

// The canvas grown to hold them; the column past the rightmost back.
export function writeAsides(canvas: Canvas, asides: Aside[]): number {
  let end = 0;
  for (const aside of asides) {
    const { row, col: at } = [aside, ...(aside.elsewhere ?? [])].find((place) => coversNoInk(canvas, place, aside.text)) ?? aside;
    const col = Math.max(0, at);
    end = Math.max(end, col + displayWidth(aside.text));
    canvas.resize(end, canvas.height);
    canvas.putText(row, col, aside.text, aside.style);
  }
  return end;
}

// mermaid's legend right of the plot, centred on its height: every titled plot, a square for a bar, a stroke for a line.
export function drawLegend(canvas: Canvas, diagram: XYChart, cs: CharSet, left: number, top: number, rows: number): void {
  if (!diagram.showLegend) return;
  const items = diagram.datasets.flatMap((ds, plot) => (ds.label === "" ? [] : [{ ds, plot }]));
  if (items.length === 0) return;
  const first = top + Math.max(0, centredOffset(rows, items.length));
  const width = left + 2 + Math.max(...items.map(({ ds }) => displayWidth(ds.label)));
  canvas.resize(width, first + items.length);
  items.forEach(({ ds, plot }, i) => {
    canvas.put(first + i, left, ds.chartType === "bar" ? cs.barFull : cs.horizontal, false, plotStyle(plot));
    canvas.putText(first + i, left + 2, ds.label, XY_LEGEND);
  });
}
