import { XY_DATA_LABEL, XY_LEGEND, XY_PLOT, XY_TITLE, XY_X_AXIS, XY_Y_AXIS, onBarOf, indexAfter, type XyAxisKeys } from "../canvas/keys.js";
import { readableStyle } from "../colour/contrast.js";
import { formatHex } from "../colour/rgb.js";
import { listed } from "../text/format.js";
import { firstInk } from "./mix.js";
import { BACKGROUND } from "./tokens.js";
import { inked } from "./style.js";
import { seatOnPage, textOnPage } from "./sections.js";
import { type Ink, type Theme, seatIn } from "./theme-model.js";

// mermaid's xychart: each text and axis part in its own `xyChart` ink (`titleColor`, `xAxisLabelColor` and their
// siblings), `primaryTextColor` where unwritten, each plot in its seat of `plotColorPalette`, the seat counted over bars
// and lines together and wrapping on the list.
export function xyChartStyles(th: Theme, keys: Iterable<string>): Array<[string, string]> {
  const v = th.variables;
  const text = v.primaryTextColor ?? v.textColor;
  const palette = listed(v.plotColorPalette ?? "");
  const written = (ink: Ink, weight: string): string => textOnPage(th, ink ?? text, weight) ?? inked(weight, ink ?? text);
  const label = (ink: Ink): string => written(ink, th.weights.edgeLabel);
  const stroke = (ink: Ink): string => inked(th.weights.edge, ink ?? text);
  const axes: ReadonlyArray<readonly [XyAxisKeys, readonly [title: Ink, label: Ink, tick: Ink, line: Ink]]> = [
    [XY_X_AXIS, [v.xyXAxisTitleColor, v.xyXAxisLabelColor, v.xyXAxisTickColor, v.xyXAxisLineColor]],
    [XY_Y_AXIS, [v.xyYAxisTitleColor, v.xyYAxisLabelColor, v.xyYAxisTickColor, v.xyYAxisLineColor]],
  ];
  const styles: Array<[string, string]> = [
    [XY_TITLE, written(v.xyTitleColor, th.weights.label)],
    [XY_DATA_LABEL, label(v.xyDataLabelColor)],
    [XY_LEGEND, label(v.xyLegendTextColor)],
    ...axes.flatMap(([keys, [title, name, tick, line]]): Array<[string, string]> => [
      [keys.title, label(title)],
      [keys.label, label(name)],
      [keys.tick, stroke(tick)],
      [keys.line, stroke(line)],
    ]),
  ];
  if (palette.length === 0) return styles;
  const seat = (plot: number): string => seatOnPage(th, seatIn(palette, plot), th.weights.node, th.node);
  for (const key of keys) {
    const index = indexAfter(key, XY_PLOT);
    if (index !== undefined) styles.push([key, seat(index)]);
    // A line's dots or a later bar's top on a bar keep the bar's colour under them, the dots weighed to read on it.
    const on = onBarOf(key);
    const ground = on === undefined ? undefined : firstInk(seat(on.bar));
    if (on === undefined || ground === undefined) continue;
    const ink = on.over === "dots" ? readableStyle(seat(on.plot), ground) : seat(on.plot);
    styles.push([key, `${ink} ${BACKGROUND}${formatHex(ground)}`]);
  }
  return styles;
}
