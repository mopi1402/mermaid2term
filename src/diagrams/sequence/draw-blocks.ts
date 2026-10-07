import { clearRect } from "../../canvas/cells.js";
import type { BlockKind, SectionKind, BoxFrame, Layout } from "./model.js";
import { centredAt, centredOffset, clip, displayWidth, widestOf } from "../../text/width.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import {
  BOX as STYLE_BOX,
  BOX_LABEL,
  NOTE as STYLE_NOTE,
  NOTE_FILL,
  NOTE_RIM,
  NOTE_LABEL,
} from "../../canvas/keys.js";
import { STYLE_BAND, STYLE_FRAME, STYLE_FRAME_TAB, STYLE_SECTION_TAB } from "./ink.js";
import { CARTOUCHE_BAR, CARTOUCHE_ROOM, labelLines } from "./metrics.js";
import { refolded } from "../../text/fold.js";
import { NEWLINE, SPACE } from "../../text/chars.js";
import { drawTightFrame } from "../../graph/render/tight.js";
import { layBand } from "../../canvas/band.js";
import { frame as ring } from "../../canvas/shape-frame.js";
import { type BlockSectionBreak, type BlockStart } from "./events.js";

export function drawBox(canvas: Canvas, frame: BoxFrame, layout: Layout, cs: CharSet, padless = false): void {
  const floor = layout.height - 1;
  const ceiling = layout.boxCeiling;
  const right = Math.min(frame.right, canvas.width - 1);
  if (right <= frame.left) return;

  // Padless draws the container the subgraphs draw, its outline on the cell edges; the title then has no rule to
  // stand on and takes the row under it, inside the frame.
  if (padless) drawTightFrame(canvas, ceiling, floor, frame.left, right, STYLE_BOX);
  else {
    const corners = [cs.dblTopLeft, cs.dblTopRight, cs.dblBottomLeft, cs.dblBottomRight] as const;
    ring(canvas, frame.left, ceiling, right - frame.left + 1, floor - ceiling + 1, cs, STYLE_BOX, corners, undefined, {
      rules: [cs.dblHorizontal, cs.dblHorizontal],
      walls: false,
      merge: false,
    });

    // A message crossing a wall keeps its cell and the wall is cut, as a subgraph's wall is under an edge.
    const opaque = new Set([STYLE_NOTE, NOTE_FILL, NOTE_LABEL, NOTE_RIM]);
    for (let r = ceiling + 1; r < floor; r++) {
      for (const col of [frame.left, right]) {
        if (opaque.has(canvas.getStyle(r, col)) || canvas.getStyle(r, col).includes(STYLE_BAND)) continue;
        if (canvas.get(r, col) === SPACE) canvas.put(r, col, cs.dblVertical, false, STYLE_BOX);
      }
    }
  }

  if (frame.title !== "") {
    const span = right - frame.left - 1;
    const written = clip(frame.title, span - 2);
    const width = displayWidth(written);
    if (width > 0) {
      const row = padless ? ceiling + 1 : ceiling;
      const at = frame.left + 1 + centredOffset(span, width);
      clearRect(canvas, row, at - 1, 1, width + 2);
      canvas.putText(row, at, written, BOX_LABEL);
    }
  }

  if (frame.fill === undefined) return;
  // A padless rule rides the INNER edge of its row, so the rest of that cell lies outside the frame and keeps the
  // page: a fill laid there would show a row of colour above the line. The walls ride the outer edge of their
  // column, so those cells are inside and take it, which is where a subgraph stops its own fill (`fillSubgraphs`).
  const from = ceiling + (padless ? 1 : 0);
  const to = floor - (padless ? 1 : 0);
  // A `rect`'s ground is already seated here and lies over the box, so the box's own fill goes under it.
  layBand(canvas, from, to, frame.left, right, frame.fill, true);
}

// A block's dotted rule across the row, its ends on the given glyphs, the dash giving way to anything already drawn.
function drawBlockRule(canvas: Canvas, row: number, [left, right]: [number, number], cs: CharSet, ends: [string, string]): void {
  canvas.put(row, left, ends[0], false, STYLE_FRAME);
  for (let c = left + 1; c < Math.min(right, canvas.width); c++) {
    if (canvas.get(row, c) === SPACE) canvas.put(row, c, cs.lineDottedH, false, STYLE_FRAME);
  }
  if (right < canvas.width) canvas.put(row, right, ends[1], false, STYLE_FRAME);
}

const cartoucheWords = (kind: BlockKind | SectionKind, label: string): string =>
  label === "" ? kind : `${kind} ${CARTOUCHE_BAR} ${label}`;

export const cartoucheSpan = (bounds: [number, number]): number => Math.max(0, (bounds[1]) - (bounds[0]) - 1);

export const cartoucheLines = (kind: BlockKind | SectionKind, label: string, span: number): string[] =>
  labelLines(refolded(cartoucheWords(kind, label), Math.max(1, span - CARTOUCHE_ROOM), NEWLINE)).map((line) => ` ${line} `);

function drawCartouche(
  canvas: Canvas,
  row: number,
  left: number,
  right: number,
  kind: BlockKind | SectionKind,
  label: string,
  // mermaid writes the opening keyword inside its label box (`.labelText`) and the condition beside it in
  // `.loopText`, two inks on one row. A section's title is `.sectionTitle` alone there, mermaid writing no `else`
  // at all; this page does write it, and a keyword is a keyword, so it takes the box's ink wherever it stands.
  keywordStyle: string = STYLE_FRAME_TAB,
  restStyle: string = STYLE_SECTION_TAB
): void {
  const span = cartoucheSpan([left, Math.min(right, canvas.width)]);
  const written = cartoucheLines(kind, label, span).map((line) => clip(line, span));
  const width = widestOf(written);
  if (width === 0) return;
  const from = left + 1 + centredOffset(span, width);
  const opening = ` ${kind} ${CARTOUCHE_BAR}`;
  written.forEach((line, at) => {
    const head = at === 0 && line.startsWith(opening) ? opening.length : at === 0 ? line.length : 0;
    for (let c = from; c < from + width; c++) {
      canvas.clearChar(row + at, c);
      canvas.setStyle(row + at, c, c < from + head ? keywordStyle : restStyle);
    }
    const start = from + centredAt(width, line);
    canvas.putText(row + at, start, line.slice(0, head), keywordStyle);
    canvas.putText(row + at, start + head, line.slice(head), restStyle);
  });
}

function drawTitledRule(
  canvas: Canvas,
  row: number,
  bounds: [number, number],
  cs: CharSet,
  ends: [string, string],
  { kind, label }: { kind: BlockKind | SectionKind; label: string }
): void {
  drawBlockRule(canvas, row, bounds, cs, ends);
  drawCartouche(canvas, row, bounds[0], bounds[1], kind, label);
}

export function drawBlockStart(canvas: Canvas, event: BlockStart, row: number, bounds: [number, number], cs: CharSet): void {
  drawTitledRule(canvas, row, bounds, cs, [cs.topLeft, cs.topRight], event.block);
}

export function drawBlockSection(canvas: Canvas, event: BlockSectionBreak, row: number, bounds: [number, number], cs: CharSet): void {
  drawTitledRule(canvas, row, bounds, cs, [cs.lineDottedV, cs.lineDottedV], event.section);
}

export function drawBlockEnd(canvas: Canvas, row: number, bounds: [number, number], cs: CharSet): void {
  drawBlockRule(canvas, row, bounds, cs, [cs.bottomLeft, cs.bottomRight]);
}

export const cartoucheText = (kind: BlockKind | SectionKind, label: string): string => ` ${cartoucheWords(kind, label)} `;
