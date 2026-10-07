import { type Bindings, type ParticipantBox, type SequenceDiagram, LEFT_OF, OVER, RIGHT_OF, type BoxFrame, type Layout } from "./model.js";
import { colourToHex } from "../../colour/colours.js";
import { displayWidth } from "../../text/width.js";
import { RECT } from "./patterns.js";
import { type FlatEvent } from "./events.js";
import { BOTTOM_MARGIN, BOX_AIR, BOX_FRAME_PAD, BOX_HEIGHT, LABEL_OFFSET, LABEL_ROOM, LINK_INSET, nameHeight, NOTE_GAP_ROOM, NOTE_PAD, participantIndex, QUEUE_SYMBOL_W, TITLE_ROWS, titleRoom, TOP_MARGIN, noteWidth } from "./metrics.js";
import { widestLine } from "../../text/width.js";
import { bindingsOf, eventHeight, markRoom, messagePad } from "./sizes.js";
import { blockSpans } from "./blocks.js";
import { cartoucheLines, cartoucheSpan } from "./draw-blocks.js";
import { widestReach } from "./reach.js";
import { selfExtent } from "./messages.js";

interface BoxSpan {
  box: ParticipantBox;
  first: number;
  last: number;
}

function boxWidthsOf(diagram: SequenceDiagram, paddingX: number): number[] {
  return diagram.participants.map((p) => {
    const linked = Math.max(0, ...p.links.map((link) => displayWidth(link.label) + LINK_INSET * 2 + 2));
    const named = Math.max(widestLine(p.label) + paddingX + 2, linked);
    if (p.kind === "queue") return Math.max(named, QUEUE_SYMBOL_W + 2);
    if (p.kind === "database") return Math.max(named, 8);
    return named;
  });
}

// Each event's rows, and each message's label ("" for any other event), by event index.
function heightsOf(diagram: SequenceDiagram, flat: FlatEvent[], { boundDestroys, destroysAt, createsAt }: Bindings, framelessNotes: boolean): { heights: number[]; labels: string[] } {
  const heights: number[] = [];
  const labels: string[] = [];
  flat.forEach((event, index) => {
    if (event.type === "message") {
      labels.push(event.label);
    } else {
      labels.push("");
    }
    if (event.type === "destroy") heights.push(boundDestroys.has(index) ? 0 : BOX_HEIGHT + 1);
    else if (event.type === "message") {
      const pad = messagePad(diagram, index, destroysAt, createsAt);
      heights.push(eventHeight(event, framelessNotes) + pad.push + pad.below);
    } else heights.push(eventHeight(event, framelessNotes));
  });
  return { heights, labels };
}

// The box each participant stands in, the first box that names it, and the run of participants each box spans.
function boxSpansOf(diagram: SequenceDiagram): { boxOf: Map<number, number>; spans: BoxSpan[] } {
  const boxOf = new Map<number, number>();
  diagram.boxes.forEach((box, b) => {
    for (const id of box.participants) {
      const at = participantIndex(diagram, id);
      if (at >= 0 && !boxOf.has(at)) boxOf.set(at, b);
    }
  });
  const spans: BoxSpan[] = diagram.boxes
    .map((box, b) => {
      const held = [...boxOf].filter(([, at]) => at === b).map(([i]) => i);
      return held.length === 0 ? undefined : { box, first: Math.min(...held), last: Math.max(...held) };
    })
    .filter((span): span is BoxSpan => span !== undefined);
  return { boxOf, spans };
}

// How far each participant's column reaches either side of its lifeline: its head, the wall of its box, the title of
// a box it stands alone in, and its self messages.
interface Reaches {
  readonly left: (i: number) => number;
  readonly right: (i: number) => number;
  readonly selfLeft: ReadonlyMap<number, number>;
  readonly selfRight: ReadonlyMap<number, number>;
}

function reachesOf(diagram: SequenceDiagram, flat: FlatEvent[], boxWidths: readonly number[], boxOf: ReadonlyMap<number, number>, spans: readonly BoxSpan[]): Reaches {
  const halfLeft = (i: number): number => Math.floor((boxWidths[i]) / 2);
  const halfRight = (i: number): number => (boxWidths[i]) - 1 - halfLeft(i);
  const alone = new Map<number, number>();
  for (const span of spans) {
    if (span.first !== span.last || span.box.title === "") continue;
    alone.set(span.first, Math.ceil((titleRoom(span.box) - 1) / 2));
  }
  // mermaid gives a self message half its label on each side of the lifeline (`getMaxMessageWidthPerActor`).
  const selfLeft = new Map<number, number>();
  const selfRight = new Map<number, number>();
  for (const event of flat) {
    if (event.type !== "message" || event.source !== event.target) continue;
    const at = participantIndex(diagram, event.source);
    if (at < 0) continue;
    const [left, right] = selfExtent(event.label);
    selfLeft.set(at, Math.max(selfLeft.get(at) ?? 0, left));
    selfRight.set(at, Math.max(selfRight.get(at) ?? 0, right));
  }
  const wall = (i: number): number => (boxOf.has(i) ? BOX_FRAME_PAD : 0);
  const selfWall = (i: number, self: Map<number, number>): number =>
    boxOf.has(i) && self.has(i) ? (self.get(i) ?? 0) + 2 : 0;
  return {
    left: (i) => Math.max(halfLeft(i) + wall(i), alone.get(i) ?? 0, selfWall(i, selfLeft)),
    right: (i) => Math.max(halfRight(i) + wall(i), alone.get(i) ?? 0, selfWall(i, selfRight)),
    selfLeft,
    selfRight,
  };
}

interface Gapping {
  readonly diagram: SequenceDiagram;
  readonly flat: FlatEvent[];
  readonly boxWidths: readonly number[];
  readonly boxOf: ReadonlyMap<number, number>;
  readonly spans: readonly BoxSpan[];
  readonly reaches: Reaches;
  readonly labels: readonly string[];
  readonly bindings: Bindings;
  readonly minGap: number;
  readonly labelled: boolean;
}

// The columns between each lifeline and the next: the heads and walls either side, then room for every note,
// message label and box title spread over the gaps it spans.
function gapsOf({ diagram, flat, boxWidths, boxOf, spans, reaches, labels, bindings, minGap, labelled }: Gapping): number[] {
  const n = diagram.participants.length;
  const { selfLeft, selfRight } = reaches;
  const gaps = n > 1 ? Array.from({ length: n - 1 }, () => minGap) : [];
  for (let i = 0; i < n - 1; i++) {
    const needed =
      boxOf.get(i) === boxOf.get(i + 1)
        ? Math.floor(((boxWidths[i]) + (boxWidths[i + 1])) / 2) + 2
        : reaches.right(i) + reaches.left(i + 1) + 2;
    const selfRoom = Math.max(selfRight.get(i) ?? 0, selfLeft.get(i + 1) ?? 0) + 2;
    gaps[i] = Math.max(gaps[i], needed, selfRoom);
  }

  const spread = (low: number, high: number, needed: number): void => {
    const spans = high - low;
    const perGap = Math.floor((needed + spans - 1) / spans);
    for (let g = low; g < high; g++) gaps[g] = Math.max(gaps[g], perGap);
  };

  flat.forEach((event, index) => {
    if (event.type === "note") {
      const width = labelled ? noteWidth(event) : NOTE_PAD;
      for (const id of event.participants) {
        const at = participantIndex(diagram, id);
        if (at < 0) continue;
        if (event.position === RIGHT_OF && at < n - 1) gaps[at] = Math.max(gaps[at], width + NOTE_GAP_ROOM);
        else if (event.position === LEFT_OF && at > 0) {
          gaps[at - 1] = Math.max(gaps[at - 1], width + NOTE_GAP_ROOM);
        }
      }
      if (event.position === OVER && event.participants.length === 2) {
        const first = participantIndex(diagram, event.participants[0]);
        const second = participantIndex(diagram, event.participants[1]);
        if (first >= 0 && second >= 0) spread(Math.min(first, second), Math.max(first, second), width);
      }
      return;
    }

    if (event.type !== "message" || !labelled) return;
    const source = participantIndex(diagram, event.source);
    const target = participantIndex(diagram, event.target);
    if (source < 0 || target < 0 || source === target) return;
    const low = Math.min(source, target);
    const high = Math.max(source, target);
    const marks = markRoom(diagram, index, low, high, boxWidths, bindings.destroysAt, bindings.createsAt);
    const room = Math.max(LABEL_ROOM, LABEL_OFFSET + marks);
    spread(low, high, widestLine(labels[index]) + room);
  });

  for (const span of spans) {
    if (span.first === span.last || span.box.title === "") continue;
    spread(span.first, span.last, titleRoom(span.box) - reaches.left(span.first) - reaches.right(span.last) - 1);
  }
  return gaps;
}

export function computeLayout(
  diagram: SequenceDiagram,
  flat: FlatEvent[],
  paddingX: number,
  minGap: number,
  labelled = true,
  framelessNotes = false,
  padless = false
): Layout {
  const n = diagram.participants.length;
  const bindings = bindingsOf(flat);
  if (n === 0) {
    return {
      bindings,
      colCenters: [],
      boxWidths: [],
      width: 0,
      height: 0,
      headerHeight: 0,
      rowOffsets: [],
      headerTop: 0,
      boxCeiling: 0,
      boxFrames: [],
      blockFrames: new Map(),
    };
  }

  const boxWidths = boxWidthsOf(diagram, paddingX);
  const standing = diagram.participants.filter((p) => !bindings.created.has(p.id));
  const headerHeight = Math.max(...(standing.length > 0 ? standing : diagram.participants).map(nameHeight));
  const { heights, labels } = heightsOf(diagram, flat, bindings, framelessNotes);
  const { boxOf, spans } = boxSpansOf(diagram);
  const reaches = reachesOf(diagram, flat, boxWidths, boxOf, spans);
  const gaps = gapsOf({ diagram, flat, boxWidths, boxOf, spans, reaches, labels, bindings, minGap, labelled });

  const colCenters = [Math.floor((boxWidths[0]) / 2) + 1];
  for (let i = 1; i < n; i++) colCenters.push((colCenters[i - 1]) + (gaps[i - 1]));

  const inset = Math.max(0, ...spans.map((span) => reaches.left(span.first) - (colCenters[span.first])));
  if (inset > 0) for (let i = 0; i < n; i++) colCenters[i] = (colCenters[i]) + inset;

  const boxFrames: BoxFrame[] = spans.map((span) => ({
    title: span.box.title,
    left: (colCenters[span.first]) - reaches.left(span.first),
    right: (colCenters[span.last]) + reaches.right(span.last),
    fill: span.box.colour === undefined ? undefined : colourToHex(span.box.colour),
  }));

  const blockFrames = blockSpans(diagram, flat, colCenters, labels, labelled);

  for (const [index, event] of flat.entries()) {
    if (event.type !== "blockStart" && event.type !== "blockSection") continue;
    const bounds = blockFrames.get(index);
    if (bounds === undefined) continue;
    const named = event.type === "blockStart" ? event.block : event.section;
    if (named.kind === RECT) continue;
    const lines = cartoucheLines(named.kind, named.label, cartoucheSpan(bounds)).length;
    heights[index] = (heights[index]) + lines - 1;
  }

  const maxRight = widestReach(diagram, flat, colCenters, boxWidths, boxFrames, blockFrames, labels, labelled);

  const boxCeiling = TOP_MARGIN;
  // A padless frame has no rule a title could sit on, its outline running on the cell edges, so a titled box
  // carries the name inside, on the same row and blank row a `title` statement spends: a name pressed against
  // the heads reads as one of them.
  const namedInside = padless && boxFrames.some((frame) => frame.title !== "");
  const headerTop = boxCeiling + (boxFrames.length > 0 ? (namedInside ? 1 + TITLE_ROWS : 1) : 0);

  const rowOffsets: number[] = [];
  // One row of lifeline between the head and the first message, whatever the participant is drawn as: a label
  // pressed against the box reads as part of it, and mermaid leaves the same air there. A symbol participant,
  // whose name sits under its glyph, already had that row; a plain box had none.
  let row = headerTop + headerHeight + 2;
  for (const height of heights) {
    rowOffsets.push(row);
    row += height;
  }

  return {
    bindings,
    colCenters,
    boxWidths,
    width: maxRight,
    height: row + BOTTOM_MARGIN + (boxFrames.length > 0 ? 1 + BOX_AIR : 0),
    headerHeight,
    rowOffsets,
    headerTop,
    boxCeiling,
    boxFrames,
    blockFrames,
  };
}
