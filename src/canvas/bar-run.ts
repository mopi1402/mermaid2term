import { LEFT_EIGHTHS } from "./alphabet.js";
import { type Canvas } from "./canvas.js";
import { eighthsRun } from "./geometry.js";

// A horizontal bar `exact` cells long from `left`, its whole cells in `fill` and its last one on the eighth it
// reaches; answers the cells it took.
export function putBarRun(canvas: Canvas, row: number, left: number, exact: number, fill: string, style: string): number {
  const { whole, eighths } = eighthsRun(exact);
  canvas.putRow(row, left, left + whole, fill, false, style);
  if (eighths === 0) return whole;
  canvas.put(row, left + whole, LEFT_EIGHTHS[eighths - 1], false, style);
  return whole + 1;
}
