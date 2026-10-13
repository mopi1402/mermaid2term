import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import type { Kanban, KanbanCard, KanbanColumn } from "./model.js";
import { centredAt, displayWidth, longestWord, truncateToWidth, widestOf } from "../../text/width.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { DEEP_SUFFIX, INK_MARK, OUT_TAIL, RIM_TAIL, SECTION_PREFIX, SLAB_TAIL, indexed } from "../../canvas/keys.js";
import { widenBox } from "../../canvas/fit-frame.js";
import { edgesOf, spanOf, type Edges } from "../../canvas/extent.js";
import { slabOutline } from "../../graph/render/slabs.js";
import { type BorderMode } from "../../source/config.js";
import { cornersOf } from "../../canvas/corners.js";
import { richRows, wrapSegments, type LabelSegment } from "../../source/markdown.js";
import { putSegments } from "../../canvas/rich.js";
import { fillInterior, frame } from "../../canvas/shape-frame.js";

const COL_PAD = 2;
const CARD_PAD = 1;
const COL_GAP = 2;
const CARD_GAP = 1;

const MIN_COLUMN = 10;
const TITLE_FRAME = 4;
const CARD_FRAME = 2;
// A title's rows come on top of these: the rules around a column title, a card's two walls.
const HEADER_ROWS = 2;
const CARD_ROWS = 2;
// The gap the width fit tightens a board to before its titles are folded.
const TIGHT_GAP = 1;
const CARD_INSET = CARD_FRAME + 2 * COL_PAD;
const MIN_ROOM = MIN_COLUMN - CARD_INSET;
// A column title stands in the room of its cards and the walls around them.
const titleRoom = (room: number): number => room + CARD_INSET - TITLE_FRAME;
// The gap between a card's ticket, on the left, and its assignee, on the right.
const INFO_GAP = 1;

const DEEP = DEEP_SUFFIX;
const sectionStyle = (index: number): string => indexed(SECTION_PREFIX, index);

interface ShownRow {
  plain: string;
  segments: LabelSegment[] | undefined;
}

// mermaid 12 draws a kanban label as markdown, fenced or not: `<br>` and a line end inside a string break it, `**`
// and `<b>` `<i>` ink its words. A row wider than `room` is folded on its words, each keeping its inks, and a lone
// word too wide is cut, written plain.
const shownRows = (text: string, room: number): ShownRow[] =>
  richRows(text)
    .flatMap((runs) => wrapSegments(runs, room))
    .map((row): ShownRow => {
      const plain = row.map((piece) => piece.text).join("");
      if (displayWidth(plain) > room) return { plain: truncateToWidth(plain, room), segments: undefined };
      return { plain, segments: row.some((piece) => piece.bold || piece.italic) ? row : undefined };
    });

const widestRow = (text: string, room: number): number => widestOf(shownRows(text, room).map((row) => row.plain));

// A row held whole keeps its weights, a row cut to `room` is written plain.
function putRow(canvas: Canvas, row: number, col: number, shown: ShownRow, room: number, style: string, centred: number | undefined): void {
  const fits = displayWidth(shown.plain) <= room;
  const text = fits ? shown.plain : truncateToWidth(shown.plain, room);
  const at = centred === undefined ? col : col + centredAt(centred, text);
  putSegments(canvas, row, at, text, fits ? shown.segments : undefined, style);
}

const hasInfo = (card: KanbanCard): boolean => card.ticket !== "" || card.assigned !== "";
// mermaid lays the ticket and the assignee on a line of their own under the title.
const rowsOf = (card: KanbanCard, room: number): number => CARD_ROWS + shownRows(card.title, room).length + (hasInfo(card) ? 1 : 0);
const infoWidth = (card: KanbanCard): number =>
  displayWidth(card.ticket) + displayWidth(card.assigned) + (card.ticket !== "" && card.assigned !== "" ? INFO_GAP : 0);

const UNBOUND = Number.POSITIVE_INFINITY;

function columnWidth(col: KanbanColumn, paddingX: number, room: number): number {
  const titleWidth = widestRow(col.title, titleRoom(room));
  const cardWidths = col.cards.map((card) => Math.max(widestRow(card.title, room), Math.min(infoWidth(card), room)));
  const cardWidth = cardWidths.length === 0 ? 0 : Math.max(...cardWidths);
  const need = Math.max(titleWidth + TITLE_FRAME, cardWidth + CARD_INSET);
  return Math.max(need + (paddingX - CARD_PAD) * 2, MIN_COLUMN);
}

const longestWordOf = (text: string): number => Math.max(0, ...shownRows(text, UNBOUND).map((row) => longestWord(row.plain)));

// A column's room in card cells for its title and its cards, as `measure` reads each title.
const columnRoom = (col: KanbanColumn, measure: (text: string) => number): number =>
  Math.max(MIN_ROOM, measure(col.title) - titleRoom(0), ...col.cards.map((card) => measure(card.title)));

// Each column's widest title row and the gap the board is drawn with: past the budget the gap tightens first, then,
// past it even at the tightest gap, the widest column folds, a cell at a time, down to its longest word, then down to
// the narrowest cards.
function roomsWithin(diagram: Kanban, paddingX: number, gap: number, budget: number | undefined): { rooms: number[]; gap: number } {
  const rooms = diagram.columns.map(() => UNBOUND);
  const tight = Math.min(gap, TIGHT_GAP);
  const widths = (): number[] => diagram.columns.map((col, i) => columnWidth(col, paddingX, rooms[i]));
  if (budget === undefined || spanOf(widths(), gap) <= budget) return { rooms, gap };
  if (spanOf(widths(), tight) <= budget) return { rooms, gap: tight };
  diagram.columns.forEach((col, i) => (rooms[i] = columnRoom(col, (text) => widestRow(text, UNBOUND))));
  const words = diagram.columns.map((col) => columnRoom(col, longestWordOf));
  for (const floors of [words, diagram.columns.map(() => MIN_ROOM)]) {
    let drawn = widths();
    while (spanOf(drawn, tight) > budget) {
      const narrowable = rooms.map((_, i) => i).filter((i) => rooms[i] > floors[i]);
      if (narrowable.length === 0) break;
      const widest = narrowable.reduce((a, b) => (drawn[b] > drawn[a] || (drawn[b] === drawn[a] && rooms[b] > rooms[a]) ? b : a));
      rooms[widest] -= 1;
      drawn = widths();
    }
  }
  return { rooms, gap: tight };
}

// `filled` says a theme lays the board's grounds, which a borderless column or card needs to show at all.
export function renderKanban(
  diagram: Kanban,
  cs: CharSet = UNICODE,
  paddingX: number = CARD_PAD,
  gap: number = COL_GAP,
  budget?: number,
  borders: BorderMode = "default",
  filled = false
): Canvas {
  if (diagram.columns.length === 0) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);

  const { rooms, gap: drawnGap } = roomsWithin(diagram, paddingX, gap, budget);
  const widths = diagram.columns.map((col, i) => columnWidth(col, paddingX, rooms[i]));

  // Rows fold at the room their column is drawn with, a narrowed padding folding them rather than cutting them.
  const heights = diagram.columns.map((col, i) => {
    const cards = col.cards.length;
    const room = widths[i] - CARD_INSET;
    return HEADER_ROWS + shownRows(col.title, titleRoom(room)).length + col.cards.reduce((sum, card) => sum + rowsOf(card, room), 0) + Math.max(0, cards - 1) * CARD_GAP + 1;
  });

  const height = Math.max(...heights);
  const width = spanOf(widths, drawnGap);
  const canvas = new Canvas(width + 1, height + 1);

  let x = 0;
  diagram.columns.forEach((col, i) => {
    const columnWidth = widths[i];
    drawColumn(canvas, col, x, 0, columnWidth, height, cs, sectionStyle(i), { borders, filled });
    x += columnWidth + drawnGap;
  });

  return canvas;
}

function drawColumn(
  canvas: Canvas,
  col: KanbanColumn,
  x: number,
  y: number,
  w: number,
  h: number,
  cs: CharSet,
  sectionStyleKey: string,
  mode: BoardBorders
): void {
  const { horizontal, vertical } = cs;
  const padless = mode.borders === "padless";
  const slabbed = mode.borders === "borderless" && mode.filled;

  const cardStyle = sectionStyleKey + DEEP;
  const cardRim = cardStyle + RIM_TAIL;

  fillInterior(canvas, x, y, w, h, sectionStyleKey);

  const rim = sectionStyleKey + RIM_TAIL;
  frame(canvas, x, y, w, h, cs, rim, cornersOf(cs, true), undefined, { merge: false });

  const titleRows = shownRows(col.title, w - TITLE_FRAME);
  titleRows.forEach((row, down) => putRow(canvas, y + 1 + down, x, row, w - TITLE_FRAME, sectionStyleKey, w));
  // A padless column's rule stands a cell inside its walls, as a class box's compartment rule does.
  const ruleInset = padless ? 1 : 0;
  canvas.putText(y + 1 + titleRows.length, x + 1 + ruleInset, horizontal.repeat(w - 2 - 2 * ruleInset), sectionStyleKey);
  reborder(canvas, edgesOf({ x, y, w, h }), sectionStyleKey, rim, true, padless, slabbed);

  let cardY = y + HEADER_ROWS + titleRows.length;
  for (const card of col.cards) {
    const cw = w - 2 * COL_PAD;
    const cx = x + COL_PAD;
    const rows = rowsOf(card, w - CARD_INSET);
    const bottom = cardY + rows - 1;
    // mermaid strokes a priority down the card's left side: here the left wall, heavy and in that colour.
    const leftWall = card.priority === undefined ? vertical : cs.lineThickV;
    const leftRim = card.priority === undefined ? cardRim : cardRim + INK_MARK + card.priority;

    frame(canvas, cx, cardY, cw, rows, cs, cardRim, cornersOf(cs, false), undefined, { merge: false });
    canvas.putColumn(cx, cardY + 1, bottom, leftWall, false, leftRim);
    fillInterior(canvas, cx, cardY, cw, rows, cardStyle);
    // A priority is the card's left border in its colour: it keeps it, and a slab would drop it.
    reborder(canvas, { top: cardY, bottom, left: cx, right: cx + cw - 1 }, cardStyle, cardRim, false, padless, slabbed && card.priority === undefined);
    if (padless && card.priority !== undefined) for (let r = cardY + 1; r < bottom; r++) canvas.setStyle(r, cx, leftRim);

    const inner = cw - CARD_FRAME;
    const cardRows = shownRows(card.title, w - CARD_INSET);
    cardRows.forEach((row, down) => putRow(canvas, cardY + 1 + down, cx + 1, row, inner, cardStyle, undefined));
    const infoRow = cardY + 1 + cardRows.length;
    if (hasInfo(card)) {
      const assigned = truncateToWidth(card.assigned, inner);
      const room = inner - displayWidth(assigned) - (assigned === "" ? 0 : INFO_GAP);
      canvas.putText(infoRow, cx + 1, truncateToWidth(card.ticket, Math.max(0, room)), cardStyle);
      canvas.putText(infoRow, cx + 1 + inner - displayWidth(assigned), assigned, cardStyle);
    }

    cardY += rows + CARD_GAP;
  }
}

interface BoardBorders {
  readonly borders: BorderMode;
  readonly filled: boolean;
}

// A column or a card under the border mode: padless moves its outline onto its cells' edges as a treemap's box, its
// rules on the ground it stands on; borderless lays it as a slab of its own ground there.
function reborder(canvas: Canvas, edges: Edges, key: string, rim: string, rounded: boolean, padless: boolean, slabbed: boolean): void {
  if (padless) widenBox(canvas, edges, key, rounded, RIM_TAIL, rim, key + OUT_TAIL);
  if (slabbed) slabOutline(canvas, edges, key + SLAB_TAIL, (r, c) => canvas.getStyle(r, c) === rim);
}
