import { clampedOn, displayWidth } from "../../text/width.js";
import { SPACE } from "../../text/chars.js";
import { EDGE, GANTT_AXIS_TEXT, INK_MARK } from "../../canvas/keys.js";
import { today, type CivilDate } from "./dates.js";
import { AXIS_ROWS, MIN_TICKS, TICK_AIR } from "./metrics.js";
import { STYLE_GRID, STYLE_TODAY } from "./ink.js";
import { isHeld, type Scene } from "./scene.js";
import { roundStops, tickStops } from "./ticks.js";
import type { Gantt } from "./model.js";

function tickColumns(scene: Scene, diagram: Gantt): Array<readonly [number, CivilDate]> {
  const { scale } = scene;
  const stops: Array<readonly [number, CivilDate]> = [];
  if (diagram.tickInterval === undefined) {
    // The chart's own two ends, and between them the finest round instants whose dates all find room, a blank
    // between two and no two neighbours named alike; a round one crowding an end gives way to it.
    const room = scale.tickPitch - TICK_AIR + 1;
    const first = scale.columnOf(scale.earliest);
    const last = scale.columnOf(scale.latest);
    const fits = (at: readonly CivilDate[]): boolean =>
      at.every((day, i) => i === 0 || (scale.columnOf(day) - scale.columnOf(at[i - 1]) >= room && scale.dateAt(day) !== scale.dateAt(at[i - 1])));
    const ticks = Math.max(MIN_TICKS, Math.round(scale.chartWidth / scale.tickPitch));
    let inner: CivilDate[] = [];
    for (let count = ticks + 1; count >= 1; count--) {
      const round = roundStops(scale.earliest, scale.latest, count, scale.chartWidth).filter(
        (day) => scale.columnOf(day) - first >= room && last - scale.columnOf(day) >= room
      );
      if (fits([scale.earliest, ...round, scale.latest])) {
        inner = round;
        break;
      }
    }
    for (const at of [scale.earliest, ...inner, scale.latest]) stops.push([scale.columnOf(at), at]);
  } else {
    for (const at of tickStops(diagram.tickInterval, diagram.weekday, scale.earliest, scale.latest, scale.chartWidth)) {
      stops.push([scale.columnOf(at), at]);
    }
  }
  return stops;
}

// One axis: its rule on `row` from `corner`, a `tee` at each tick and the dates on `labelRow`.
function drawRule(scene: Scene, stops: ReadonlyArray<readonly [number, CivilDate]>, row: number, labelRow: number, corner: string, tee: string): void {
  const { canvas, cs, scale } = scene;
  const { marginLeft, chartWidth, drawnWidth } = scale;
  canvas.put(row, marginLeft, corner, false, EDGE);
  canvas.putRow(row, marginLeft + 1, marginLeft + chartWidth, cs.horizontal, false, EDGE);
  let written = -1;
  let last = "";
  for (const [col, at] of stops) {
    // mermaid's ticks are its grid lines, `.grid .tick` in `gridColor`; only the rule itself is the axis.
    canvas.put(row, col, tee, false, STYLE_GRID);
    const label = scale.dateAt(at);
    const at_ = clampedOn(col, label, drawnWidth);
    if (label !== last && at_ > written) {
      canvas.putText(labelRow, at_, label, GANTT_AXIS_TEXT);
      written = at_ + displayWidth(label);
      last = label;
    }
  }
}

// `topAxis` adds mermaid's `axisTop` over the chart, the bottom axis kept.
export function drawAxis(scene: Scene, diagram: Gantt, axisRow: number): void {
  const { canvas, cs, scale } = scene;
  const { marginLeft } = scale;

  canvas.putColumn(marginLeft, scene.chartTop, axisRow, cs.vertical, false, EDGE);

  if (diagram.todayMarker) {
    const offset = today() - scale.earliest;
    if (offset >= 0 && offset <= scale.span) {
      const col = scale.columnOf(today());
      const style = diagram.todayInk === undefined ? STYLE_TODAY : STYLE_TODAY + INK_MARK + diagram.todayInk;
      for (let r = scene.chartTop; r < axisRow; r++) {
        const existing = canvas.get(r, col);
        if (isHeld(scene, r, col)) continue;
        if (existing === SPACE || existing === cs.ruleDashed) canvas.put(r, col, cs.todayMark, false, style);
      }
    }
  }

  const stops = tickColumns(scene, diagram);
  drawRule(scene, stops, axisRow, axisRow + 1, cs.bottomLeft, cs.teeDown);
  if (diagram.topAxis) drawRule(scene, stops, scene.chartTop - 1, scene.chartTop - AXIS_ROWS, cs.topLeft, cs.teeUp);
  // One unbroken line per tick, crossing the rules between sections: only a bar, a mark or a label stops it. A tick
  // on the chart's first date has the left wall for its line; one past it, a first weekly tick say, draws its own.
  const first = scene.scale.columnOf(scene.scale.earliest);
  stops.forEach(([col]) => {
    if (col <= first) return;
    for (let r = scene.chartTop; r < axisRow; r++) {
      const under = canvas.get(r, col);
      if ((under === SPACE || under === cs.ruleDashed) && !isHeld(scene, r, col)) canvas.put(r, col, cs.gridLine, false, STYLE_GRID);
    }
  });
}
