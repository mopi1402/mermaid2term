import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import { fieldBits, type Packet } from "./model.js";
import { centredAt, displayWidth, truncateToWidth } from "../../text/width.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { EDGE_LABEL, LABEL, NODE, PACKET_TITLE } from "../../canvas/keys.js";
import { cornersOf } from "../../canvas/corners.js";
import { OWN_KEY, widenFrame } from "../../canvas/fit-frame.js";
import { TITLE_GAP } from "../@common/titled.js";

const BITS_PER_COL = 3;
const MARGIN = 1;
const STRIP_WALLS = 2;
const MIN_NUMBERED_COLS = 4;
const LEGEND_SLACK = 10;
const CANVAS_SLACK = 4;
const LABEL_FRAME = 2;
// mermaid stops splitting blocks into rows past `maxPacketSize` (10 000) rows; a terminal stops far sooner.
const MAX_ROWS = 500;

type Span = readonly [number, number, string];

// The widest row the budget holds: halved until three columns a bit and the closing wall fit, so a byte stays whole.
function foldedRowBits(rowBits: number, budget: number | undefined): number {
  let bits = rowBits;
  while (budget !== undefined && bits > 1 && bits * BITS_PER_COL + 1 > budget) bits = Math.ceil(bits / 2);
  return bits;
}

// Under padless each row's outline moves onto its cells' edges as a treemap's boxes do, its rules on the inner edge
// where the walls between the fields meet them; the corners square, as a sequence head's are, an arc there having no
// eighth to end on. A packet lays no ground, so borderless leaves its outline, as it leaves any box it cannot slab.
export function renderPacket(diagram: Packet, cs: CharSet = UNICODE, rounded = true, paddingY = 1, budget?: number, padless = false): Canvas {
  if (diagram.fields.length === 0) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);

  const rowBits = foldedRowBits(diagram.rowBits, budget);
  const colsPerRow = rowBits * BITS_PER_COL;

  const horizontal = cs.horizontal;
  const vertical = cs.vertical;
  const [topLeft, topRight, bottomLeft, bottomRight] = cornersOf(cs, rounded && !padless);
  const [topJoin, bottomJoin] = [cs.teeDown, cs.teeUp];

  // Every piece of a block split at a row end carries its label, as mermaid's `getNextFittingBlock` does.
  const rows: Span[][] = [];
  const narrowest: number[] = [];
  diagram.fields.forEach((field, fi) => {
    let bit = field.start;
    while (bit <= field.end && Math.floor(bit / rowBits) < MAX_ROWS) {
      const index = Math.floor(bit / rowBits);
      const column = bit % rowBits;
      const bits = Math.min(field.end - bit + 1, rowBits - column);
      while (rows.length <= index) rows.push([]);
      rows[index].push([column, column + bits - 1, field.label]);
      narrowest[fi] = Math.min(narrowest[fi] ?? bits, bits);
      bit += bits;
    }
  });

  const numbers = diagram.showBits ? 1 : 0;
  const rowHeight = numbers + STRIP_WALLS + paddingY;
  const height = rows.length * rowHeight;
  const canvas = new Canvas(MARGIN + colsPerRow + 1 + CANVAS_SLACK, height + LEGEND_SLACK);

  rows.forEach((spans, ri) => {
    const yNumbers = ri * rowHeight;
    const yTop = yNumbers + numbers;
    const yBottom = yTop + 1 + paddingY;
    const yContent = yTop + Math.floor((paddingY + 1) / 2);
    const rowStartBit = ri * rowBits;

    const taken = new Set<number>();
    const first = spans[0];
    const last = spans[spans.length - 1];

    // A row mermaid leaves short ends with its last block, and a lone one-bit block has one number, not two.
    const rowCols = last === undefined ? colsPerRow : (last[1] + 1) * BITS_PER_COL;
    if (numbers > 0 && last !== undefined && !(last === first && last[0] === last[1])) {
      const label = String(rowStartBit + last[1]);
      const at = MARGIN + (last[1] + 1) * BITS_PER_COL - displayWidth(label);
      canvas.putText(yNumbers, at, label, EDGE_LABEL);
      for (let px = at; px <= at + displayWidth(label); px++) taken.add(px);
    }

    if (numbers > 0 && first !== undefined) {
      const label = String(rowStartBit + first[0]);
      const at = MARGIN + first[0] * BITS_PER_COL;
      canvas.putText(yNumbers, at, label, EDGE_LABEL);
      // The cell past it too, so the next number keeps a blank from it.
      for (let px = at; px <= at + displayWidth(label); px++) taken.add(px);
    }

    for (let fi = 1; fi < spans.length && numbers > 0; fi++) {
      const [start, end] = spans[fi];
      const [previousStart, previousEnd] = spans[fi - 1];

      if ((previousEnd - previousStart + 1) * BITS_PER_COL >= MIN_NUMBERED_COLS) {
        const label = String(rowStartBit + previousEnd);
        const at = MARGIN + (previousEnd + 1) * BITS_PER_COL - displayWidth(label);
        const columns = range(at, at + displayWidth(label) + 1);
        if (!columns.some((px) => taken.has(px))) {
          canvas.putText(yNumbers, at, label, EDGE_LABEL);
          for (const px of columns) taken.add(px);
        }
      }

      if ((end - start + 1) * BITS_PER_COL >= MIN_NUMBERED_COLS) {
        const label = String(rowStartBit + start);
        const at = MARGIN + start * BITS_PER_COL + 1;
        const columns = range(at, at + displayWidth(label));
        if (!columns.some((px) => taken.has(px))) {
          canvas.putText(yNumbers, at, label, EDGE_LABEL);
          for (const px of columns) taken.add(px);
        }
      }
    }

    // A row's top or bottom rule, joined where each field after the first begins.
    const rule = (y: number, left: string, right: string, join: string): void => {
      canvas.put(y, MARGIN, left, false, NODE);
      canvas.putRow(y, MARGIN + 1, MARGIN + rowCols, horizontal, false, NODE);
      canvas.put(y, MARGIN + rowCols, right, false, NODE);
      for (const [start] of spans) {
        if (start > 0) canvas.put(y, MARGIN + start * BITS_PER_COL, join, false, NODE);
      }
    };
    rule(yTop, topLeft, topRight, topJoin);

    for (let py = 0; py < paddingY; py++) {
      const row = yTop + 1 + py;
      canvas.put(row, MARGIN, vertical, false, NODE);
      canvas.put(row, MARGIN + rowCols, vertical, false, NODE);
      for (const [start] of spans) {
        if (start > 0) canvas.put(row, MARGIN + start * BITS_PER_COL, vertical, false, NODE);
      }
    }

    for (const [start, end, label] of spans) {
      if (label === "") continue;
      const from = MARGIN + start * BITS_PER_COL;
      const available = MARGIN + (end + 1) * BITS_PER_COL - from - LABEL_FRAME;
      const shown = truncateToWidth(label, available);
      canvas.putText(yContent, from + 1 + centredAt(available, shown), shown, LABEL);
    }

    rule(yBottom, bottomLeft, bottomRight, bottomJoin);
    if (padless) widenFrame(canvas, yTop, yBottom, MARGIN, MARGIN + rowCols, NODE, false, OWN_KEY);
  });

  // mermaid writes the title centred under the last row, across the full row width.
  const titled = diagram.title === "" ? 0 : TITLE_GAP + 1;
  if (titled > 0) {
    const room = colsPerRow + 1;
    const title = budget === undefined ? diagram.title : truncateToWidth(diagram.title, Math.max(room, budget));
    const wide = Math.max(room, displayWidth(title));
    canvas.resize(MARGIN + wide, canvas.height);
    canvas.putText(height + TITLE_GAP, MARGIN + Math.max(0, centredAt(room, title)), title, PACKET_TITLE);
  }

  const available = (fi: number): number => (narrowest[fi] ?? fieldBits(diagram.fields[fi])) * BITS_PER_COL - LABEL_FRAME;
  const cut = diagram.fields.flatMap((field, fi) => (field.label !== "" && available(fi) < displayWidth(field.label) ? [fi] : []));

  if (cut.length > 0) {
    const yLegend = height + titled + 1;
    const legend = cut.map((fi) => {
      const field = diagram.fields[fi];
      const bits = field.start === field.end ? `[${field.start}]` : `[${field.start}-${field.end}]`;
      return `${truncateToWidth(field.label, available(fi))} = ${field.label} ${bits}`;
    });
    // The legend is never cut: it widens the drawing past the rows where it runs longer.
    canvas.resize(MARGIN + Math.max(...legend.map(displayWidth)), yLegend + cut.length + 1);
    legend.forEach((shown, i) => canvas.putText(yLegend + i, MARGIN, shown, EDGE_LABEL));
  }

  return canvas;
}

const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
