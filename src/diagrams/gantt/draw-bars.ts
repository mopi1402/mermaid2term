import { displayWidth, truncateToWidth } from "../../text/width.js";
import { CLICKABLE_TAIL, CRIT_BORDER, GANTT_INSIDE_PREFIX, GANTT_OUTSIDE_ACTIVE_TEXT, GANTT_OUTSIDE_TEXT, GANTT_TASK, TASK_ACTIVE } from "../../canvas/keys.js";
import { LABEL_COLUMN, LABEL_MARGIN } from "./metrics.js";
import { STYLE_CRIT, STYLE_DONE, STYLE_MILESTONE, STYLE_RULE, sectionLabelStyle } from "./ink.js";
import { endOf, type Plan } from "./names.js";
import { holdCell, markSolo, type Scene } from "./scene.js";
import type { Canvas } from "../../canvas/canvas.js";
import type { Bar, Band } from "./bars.js";
import { sectionHeight, type Rows } from "./rows.js";

export interface Drawn {
  readonly bands: Array<[number, number, number]>;
  readonly axisRow: number;
  // The row each line starts on, line after line in drawing order.
  readonly lineTops: readonly number[];
}

// mermaid strokes a crit bar in `critBorderColor` and keeps its state's fill; a whole-glyph bar has no stroke, so a
// done or active crit bar wears the stroke's ink and a plain one its fill.
function barInk(bar: Bar): string {
  const [, , , style, isCrit] = bar;
  const body = style === "done" ? STYLE_DONE : style === "active" ? TASK_ACTIVE : isCrit ? STYLE_CRIT : GANTT_TASK;
  const stateful = style === "done" || style === "active";
  return isCrit ? (stateful ? CRIT_BORDER : STYLE_CRIT) : body;
}

// A clickable task's name wears the mark mermaid's `.clickable` rules read.
const clicked = (key: string, clickable: boolean): string => (clickable ? key + CLICKABLE_TAIL : key);

// Beside its bar, an active name takes `.activeText`'s ink; a clickable one keeps `.clickable`'s, the stronger rule.
const outsideKey = (style: string, clickable: boolean): string =>
  clickable ? GANTT_OUTSIDE_TEXT + CLICKABLE_TAIL : style === "active" ? GANTT_OUTSIDE_ACTIVE_TEXT : GANTT_OUTSIDE_TEXT;

// The name carries the task's `click` link, as mermaid wraps the task's text in its anchor.
function putName(canvas: Canvas, row: number, col: number, text: string, bar: Bar): void {
  const [, , , , , link, clickable] = bar;
  canvas.putText(row, col, text, clicked(GANTT_OUTSIDE_TEXT, clickable));
  if (link !== undefined) canvas.linkLabel(row, col, displayWidth(text), 1, link);
}

export function drawBars(scene: Scene, grouped: readonly Band[], rows: Rows, plan: Plan | undefined): Drawn {
  const { canvas, cs, scale, compact } = scene;
  const { marginLeft, chartWidth, totalWidth } = scale;
  const bands: Array<[number, number, number]> = [];
  const lineTops: number[] = [];
  let row = scene.chartTop;

  grouped.forEach(([sectionLines], si) => {
    const top = row;
    sectionLines.forEach((text, i) => canvas.putText(top + i, 1, text, sectionLabelStyle(si)));
    row = compact ? top : top + sectionLines.length;

    rows.bySection[si].forEach((line, li) => {
      const ordinal = lineTops.length;
      const height = rows.heights[si][li];
      lineTops.push(row);
      if (!compact) {
        putName(canvas, row, LABEL_COLUMN, truncateToWidth(line.bars[0][0], marginLeft - LABEL_MARGIN), line.bars[0]);
      }

      const planned = plan?.lines[ordinal];
      const ordered = planned?.ordered ?? [...line.seats].sort((a, b) => a.from - b.from);
      ordered.forEach((seat, i) => {
        const [, , , style, , link, clickable] = seat.bar;
        const ink = barInk(seat.bar);
        const tall = style === "milestone" ? 1 : height;
        for (let r = row; r < row + tall; r++) if (seat.from === seat.to) markSolo(scene, r, seat.from);
        if (style === "milestone") {
          canvas.put(row, seat.from, cs.milestone, false, STYLE_MILESTONE);
        } else if (compact) {
          // The bar is its own ground, the name written on it; one that runs into the next ends on a half cell, the
          // page showing between the two.
          const touched = ordered[i + 1]?.from === seat.to + 1;
          for (let r = row; r < row + height; r++) {
            for (let c = seat.from; c <= seat.to; c++) if (c < totalWidth) canvas.setStyle(r, c, GANTT_INSIDE_PREFIX + ink);
            if (touched && seat.to > seat.from && seat.to < totalWidth) canvas.put(r, seat.to, cs.barSplit, false, ink);
            for (let c = seat.from; c <= seat.to; c++) if (c < totalWidth) holdCell(scene, r, c);
          }
        } else {
          // Every state is told by its ink alone, as mermaid does; a bar that meets one of the same ink on the row above
          // stands an eighth lower, the page showing between the two.
          const bar = (c: number): boolean => [cs.barFull, cs.barBelow].includes(canvas.get(row - 1, c)) && canvas.getStyle(row - 1, c) === ink;
          const ch = Array.from({ length: seat.to - seat.from + 1 }, (_, k) => seat.from + k).some(bar) ? cs.barBelow : cs.barFull;
          for (let c = seat.from; c <= seat.to; c++) if (c < totalWidth) canvas.put(row, c, ch, false, ink);
        }
        const name = planned?.names[i];
        if (name === undefined) return;
        const written = name.inside ? clicked(GANTT_INSIDE_PREFIX + ink, clickable) : outsideKey(style, clickable);
        name.rows.forEach((laid, k) => {
          for (const [col, ch] of laid) canvas.putText(row + k, col, ch, written);
          if (link !== undefined && laid.length > 0) canvas.linkLabel(row + k, laid[0][0], endOf(laid) - laid[0][0] + 1, 1, link);
          if (name.inside) return;
          for (const [col, ch] of laid) for (let c = col; c < col + displayWidth(ch); c++) holdCell(scene, row + k, c);
        });
      });

      if (compact && line.seats.length === 0) {
        putName(canvas, row, marginLeft + 1, truncateToWidth(line.bars[0][0], chartWidth - 1), line.bars[0]);
      }

      row += height;
    });
    row = top + sectionHeight(sectionLines.length, rows.heights[si].reduce((a, b) => a + b, 0), compact);
    bands.push([si, top, row]);
    if (si < grouped.length - 1) {
      canvas.putRow(row, 1, marginLeft + chartWidth, cs.ruleDashed, false, STYLE_RULE);
      row += 1;
    }
  });

  return { bands, axisRow: row, lineTops };
}
