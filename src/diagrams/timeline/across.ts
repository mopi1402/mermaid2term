import type { Timeline } from "./model.js";
import { eventStyle, linesOf, periodsOf, sectionFill, type Period } from "./periods.js";
import { WRAP } from "./metrics.js";
import { centredAt, widestOf } from "../../text/width.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import { ARROW, DEFAULT_STYLE, EDGE, sectionForeground } from "../../canvas/keys.js";
import { sectionBand } from "../@common/section-band.js";

const COL_PAD = 2;
const MIN_COL = 7;
const MAX_COL = 24;

interface Column {
  period: Period;
  width: number;
}

interface Band {
  lines: string[];
  from: number;
  count: number;
}

function laid(diagram: Timeline, cap: number, budget: number | undefined): { cols: Column[]; bands: Band[] } {
  const cols = periodsOf(diagram, cap).map((period) => ({
    period,
    width: Math.max(MIN_COL, widestOf([...period.title, ...period.details])) + COL_PAD,
  }));

  // mermaid's section node spans its periods' nodes (`200 * n - 50`), so its name folds at that span.
  const bands: Band[] = [];
  let at = 0;
  for (const section of diagram.sections) {
    const n = section.events.length;
    if (n === 0) continue;
    const span = cols.slice(at, at + n);
    const room = n * (cap + COL_PAD + 1) - 1 - COL_PAD;
    const { lines, widths } = sectionBand(section.title, room, span.map((col) => col.width), 1, COL_PAD, linesOf);
    span.forEach((col, i) => {
      col.width = widths[i];
    });
    bands.push({ lines, from: at, count: n });
    at += n;
  }

  if (budget !== undefined) {
    const held = (floor: number): number =>
      cols.reduce((total, col) => total + Math.max(col.width, floor), 0) + cols.length + 1;
    let floor = 0;
    while (floor < MAX_COL && held(floor + 1) <= budget) floor += 1;
    for (const col of cols) col.width = Math.max(col.width, floor);
  }
  return { cols, bands };
}

export function renderTimelineHorizontal(diagram: Timeline, cs: CharSet = UNICODE, budget?: number, cap = WRAP): Canvas {
  const { cols, bands } = laid(diagram, cap, budget);
  if (cols.length === 0) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);

  const starts: number[] = [];
  let offset = 1;
  for (const col of cols) {
    starts.push(offset);
    offset += col.width + 1;
  }
  const width = offset;
  const after = (i: number): number => starts[i] + cols[i].width;
  const centres = cols.map((col, i) => starts[i] + Math.floor(col.width / 2));

  const named = diagram.sections.some((section) => section.title !== "");
  const bandRows = named ? Math.max(1, ...bands.map((band) => band.lines.length)) : 0;
  const titleRows = Math.max(1, ...cols.map((col) => col.period.title.length));
  const details = Math.max(...cols.map((col) => col.period.details.length));
  const canvas = new Canvas(width, (named ? bandRows + 2 : 1) + titleRows + details + 3);

  const rule = (row: number, left: string, atSection: string, atColumn: string, right: string): void => {
    canvas.put(row, 0, left, false, DEFAULT_STYLE);
    cols.forEach((col, i) => {
      canvas.putRow(row, starts[i], after(i), cs.horizontal, false, DEFAULT_STYLE);
      const last = i === cols.length - 1;
      const boundary = !last && cols[i + 1].period.section !== col.period.section;
      canvas.put(row, after(i), last ? right : boundary ? atSection : atColumn, false, DEFAULT_STYLE);
    });
  };
  const walls = (row: number, everyColumn: boolean): void => {
    canvas.put(row, 0, cs.vertical, false, DEFAULT_STYLE);
    cols.forEach((col, i) => {
      const last = i === cols.length - 1;
      const boundary = last || cols[i + 1].period.section !== col.period.section;
      if (everyColumn || boundary) canvas.put(row, after(i), cs.vertical, false, DEFAULT_STYLE);
    });
  };
  const centred = (row: number, i: number, text: string, style: string): void => {
    canvas.putText(row, starts[i] + Math.max(0, centredAt(cols[i].width, text)), text, style);
  };

  let row = 0;

  if (named) {
    rule(row, cs.topLeft, cs.teeDown, cs.horizontal, cs.topRight);
    row += 1;
    for (let line = 0; line < bandRows; line++) {
      walls(row, false);
      for (const band of bands) {
        const from = starts[band.from];
        const to = after(band.from + band.count - 1);
        const fill = sectionFill(cols[band.from].period.section);
        for (let c = from; c < to; c++) canvas.setStyle(row, c, fill);
        const text = band.lines[line] ?? "";
        canvas.putText(row, from + Math.max(0, centredAt(to - from, text)), text, fill);
      }
      row += 1;
    }
    rule(row, cs.teeRight, cs.cross, cs.teeDown, cs.teeLeft);
  } else {
    rule(row, cs.topLeft, cs.teeDown, cs.teeDown, cs.topRight);
  }
  row += 1;

  for (let line = 0; line < titleRows; line++) {
    walls(row, true);
    cols.forEach((col, i) => {
      const text = col.period.title[line];
      if (text !== undefined) centred(row, i, text, sectionForeground(col.period.colour));
    });
    row += 1;
  }

  for (let line = 0; line < details; line++) {
    walls(row, true);
    cols.forEach((col, i) => {
      const detail = col.period.details[line];
      if (detail !== undefined) centred(row, i, detail, eventStyle(col.period.colour));
    });
    row += 1;
  }

  rule(row, cs.bottomLeft, cs.teeUp, cs.teeUp, cs.bottomRight);
  for (const at of centres) canvas.put(row, at, cs.teeDown, false, EDGE);
  row += 1;

  for (const at of centres) canvas.put(row, at, cs.lineVertical, false, EDGE);
  row += 1;

  canvas.putRow(row, 0, width, cs.horizontal, false, EDGE);
  for (const at of centres) canvas.put(row, at, cs.teeUp, false, EDGE);
  canvas.put(row, width - 1, cs.arrowRight, false, ARROW);
  return canvas;
}
