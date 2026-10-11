import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import type { PieChart } from "./model.js";
import { centredOffset, displayWidth, truncateToWidth, widestOf } from "../../text/width.js";
import { Canvas } from "../../canvas/canvas.js";
import { EDGE, PIE_LEGEND_TEXT, PIE_SECTION_TEXT, PIE_SLICE_PREFIX, PIE_TITLE, indexed } from "../../canvas/keys.js";
import { cellShares } from "./shares.js";
import { putBarRun } from "../../canvas/bar-run.js";
import { titledAbove } from "../@common/titled.js";

const BAR_WIDTH = 40;
const MIN_BAR_WIDTH = 10;
const MARGIN = 2;
const PERCENT = 100;
const PERCENT_COLUMNS = 5;
const PERCENT_DECIMALS = 1;
const STACKED_ROWS = 4;
const MIN_LABELLED_SEGMENT = 4;
const LABEL_GAP = 1;
// mermaid leaves out of the circle a slice whose share rounds to 0 %, `toFixed(0) === "0"`, and keeps it in the legend.
const NO_SHARE = "0";
// Every legend row keeps one whole cell of bar, the swatch its colour is read from, however small its slice.
const MIN_BAR_RUN = 1;

interface Segment {
  readonly start: number;
  readonly width: number;
  readonly texts: readonly string[];
}

export function renderPieChart(diagram: PieChart, cs: CharSet = UNICODE, budget?: number): Canvas {
  const total = diagram.slices.reduce((sum, s) => sum + s.value, 0);
  // mermaid still draws its outer circle when nothing fills it, the stacked bar stands for it
  const empty = total <= 0;
  const share = (value: number): number => (empty ? 0 : (value / total) * PERCENT);

  const suffixes = diagram.slices.map((s) => {
    const percent = ` ${share(s.value).toFixed(PERCENT_DECIMALS).padStart(PERCENT_COLUMNS)}%`;
    return diagram.showData ? `${percent}  [${s.value}]` : percent;
  });
  const maxSuffixLen = widestOf(suffixes);

  // Under a width budget the bar shrinks first, down to MIN_BAR_WIDTH, then the legend labels are cut.
  const fullLabel = widestOf(diagram.slices.map((s) => s.label));
  const room = budget === undefined ? Number.POSITIVE_INFINITY : budget - 1 - maxSuffixLen;
  const barWidth = Math.max(MIN_BAR_WIDTH, Math.min(BAR_WIDTH, room - fullLabel));
  const labels = diagram.slices.map((s) => truncateToWidth(s.label, Math.max(1, room - barWidth)));
  const maxLabelLen = widestOf(labels);
  const labelColumns = maxLabelLen + MARGIN;

  const drawn = diagram.slices.flatMap((s, i) => (!empty && share(s.value).toFixed(0) !== NO_SHARE ? [{ s, i }] : []));
  const widths = cellShares(drawn.map(({ s }) => s.value), barWidth);
  const stackedWidth = widths.reduce((sum, w) => sum + w, 0);

  const barLeft = labelColumns;
  const canvasWidth = barLeft + Math.max(barWidth + maxSuffixLen, stackedWidth + 1) + MARGIN;
  const stackedTop = MARGIN;
  const barsTop = stackedTop + STACKED_ROWS;
  const canvas = new Canvas(canvasWidth, barsTop + diagram.slices.length + MARGIN);

  const stackedLeft = barLeft + 1;
  if (empty) canvas.putRow(stackedTop, stackedLeft, stackedLeft + barWidth, cs.lineDottedH, false, EDGE);
  let column = 0;
  const segments: Segment[] = [];
  drawn.forEach(({ s, i }, at) => {
    const width = widths[at];
    const slice = indexed(PIE_SLICE_PREFIX, i);
    canvas.putRow(stackedTop, stackedLeft + column, stackedLeft + column + width, cs.sliceFill, false, slice);
    const percent = `${share(s.value).toFixed(0)}%`;
    const labelled = s.label === "" ? [percent] : [`${s.label} ${percent}`];
    segments.push({ start: column, width, texts: width >= MIN_LABELLED_SEGMENT ? [...labelled, percent] : labelled });
    column += width;
  });

  const labelRow = stackedTop + 1;
  let free = 0;
  for (const { start, width, texts } of segments) {
    for (const text of texts) {
      const textWidth = displayWidth(text);
      const at = Math.max(free, start + centredOffset(width, textWidth));
      if (textWidth > width || at + textWidth > start + width) continue;
      canvas.putText(labelRow, stackedLeft + at, text, PIE_SECTION_TEXT);
      free = at + textWidth + LABEL_GAP;
      break;
    }
  }

  diagram.slices.forEach((s, i) => {
    const row = barsTop + i;

    canvas.putText(row, MARGIN + maxLabelLen - displayWidth(labels[i]), labels[i], PIE_LEGEND_TEXT);
    canvas.put(row, barLeft, cs.barWall, false, EDGE);
    const slice = indexed(PIE_SLICE_PREFIX, i);
    const exact = Math.max(MIN_BAR_RUN, (share(s.value) / PERCENT) * barWidth);
    const barLength = putBarRun(canvas, row, barLeft + 1, exact, cs.sliceFill, slice);
    canvas.putText(row, barLeft + 1 + barLength, suffixes[i], PIE_LEGEND_TEXT);
  });

  return titledAbove(canvas, diagram.title, { key: PIE_TITLE, left: undefined, budget, over: [MARGIN, canvasWidth - 2 * MARGIN] });
}
