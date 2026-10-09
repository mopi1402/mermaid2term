import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { GANTT_TITLE } from "../../canvas/keys.js";
import { titledAbove } from "../@common/titled.js";
import type { Gantt } from "./model.js";
import { AXIS_ROWS, DEFAULT_WIDTH } from "./metrics.js";
import { collectBars } from "./collect.js";
import { chartScale } from "./scale.js";
import { chartRows, raised } from "./rows.js";
import { planNames } from "./names.js";
import { drawMarkers, markerRowsOf, seatMarkers } from "./markers.js";
import { drawBars } from "./draw-bars.js";
import { drawAxis } from "./axis.js";
import { washBands } from "./wash.js";
import type { Scene } from "./scene.js";

export function renderGantt(
  diagram: Gantt,
  cs: CharSet = UNICODE,
  width: number = DEFAULT_WIDTH,
  compact = false
): Canvas {
  if (diagram.sections.length === 0) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);

  const { grouped, markers, earliest, latest, labelWidth } = collectBars(diagram, compact);
  if (earliest === undefined || latest === undefined) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);

  const scale = chartScale(diagram, earliest, latest, labelWidth, width);
  const chartTop = diagram.topAxis ? AXIS_ROWS : 0;
  const lines = chartRows(grouped, scale, compact);
  const inSpan = markers.filter(([day]) => day >= scale.earliest && day - scale.earliest <= scale.span);
  const plan = compact ? planNames(lines.bySection.flat(), scale, new Set(inSpan.map(([day]) => scale.columnOf(day)))) : undefined;
  const rows = plan === undefined ? lines : raised(lines, grouped, plan.lines.map((line) => line.height), compact);
  const unders = (plan?.unders ?? []).flatMap((under) => {
    const [title, start] = under.seat.bar;
    return start === undefined ? [] : [[start, title, under] as const];
  });
  const markerSeats = seatMarkers([...markers, ...unders], scale);
  const height = chartTop + rows.taskRows + AXIS_ROWS + markerRowsOf(markerSeats) + 1 + 1;
  const canvas = new Canvas(scale.drawnWidth, height);
  const scene: Scene = { canvas, cs, scale, compact, chartTop, held: new Set<number>(), solo: new Set<number>() };

  const { bands, axisRow, lineTops } = drawBars(scene, grouped, rows, plan);
  drawAxis(scene, diagram, axisRow);
  drawMarkers(scene, markerSeats, axisRow, diagram.topAxis, lineTops);
  washBands(scene, diagram, bands, axisRow);

  return titledAbove(canvas, diagram.title, { key: GANTT_TITLE, left: undefined, budget: width, over: [scale.marginLeft, scale.chartWidth] });
}
