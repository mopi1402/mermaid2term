import { type Bindings, type ParticipantKind, type SequenceDiagram, DEFAULT_KIND } from "./model.js";
import { RECT } from "./patterns.js";
import { createAt, kindOf, participantOf, type FlatEvent } from "./events.js";
import { BLOCK_END_H, BLOCK_SECTION_H, BLOCK_START_H, BOX_HEIGHT, EVENT_ROW_H, KIND_HEIGHT, KIND_REACH, kindAnchor, labelLines, nameHeight, NOTE_FRAME_ROWS, participantIndex, RECT_END_H, RECT_START_H, noteLines } from "./metrics.js";

const boundToMessage = (flat: FlatEvent[], kind: "create" | "destroy"): Map<number, number> => {
  const bound = new Map<number, number>();
  flat.forEach((event, index) => {
    if (event.type !== kind) return;
    for (let j = index + 1; j < flat.length; j++) {
      const later = flat[j];
      if (later.type !== "message" || later.source === later.target) continue;
      if (later.source === event.participant || later.target === event.participant) {
        bound.set(index, j);
        return;
      }
    }
  });
  return bound;
};

function boundByMessage(flat: FlatEvent[], bound: Map<number, number>): Map<number, string[]> {
  const at = new Map<number, string[]>();
  for (const [d, m] of bound) {
    const participant = participantOf(flat[d]);
    const list = at.get(m);
    if (list === undefined) at.set(m, [participant]);
    else list.push(participant);
  }
  return at;
}

export function eventHeight(event: FlatEvent, framelessNotes = false): number {
  switch (event.type) {
    case "activate":
      return 0;
    case "create":
      return 0;
    case "destroy":
      return EVENT_ROW_H + BOX_HEIGHT;
    case "note":
      return noteLines(event).length + (framelessNotes ? 0 : NOTE_FRAME_ROWS);
    case "blockStart":
      return event.block.kind === RECT ? RECT_START_H : BLOCK_START_H;
    case "blockSection":
      return BLOCK_SECTION_H;
    case "blockEnd":
      return event.block.kind === RECT ? RECT_END_H : BLOCK_END_H;
    case "message": {
      const extra = Math.max(0, labelLines(event.label).length - 1);
      const loop = event.source === event.target ? (event.arrowType === "bidirectional" ? 2 : 1) : 0;
      return EVENT_ROW_H + loop + extra;
    }
    default:
      return 0;
  }
}

export function markReach(kind: ParticipantKind, boxWidth: number): readonly [number, number] {
  const own = KIND_REACH[kind];
  if (own !== undefined) return own;
  const left = Math.floor(boxWidth / 2);
  return [left, boxWidth - 1 - left + (kind === "collections" ? 1 : 0)];
}

export function markRoom(
  diagram: SequenceDiagram,
  index: number,
  low: number,
  high: number,
  boxWidths: readonly number[],
  destroysAt: Map<number, string[]>,
  createsAt: Map<number, string[]>
): number {
  let room = 0;
  const eaten = (at: number, reach: readonly [number, number]): number =>
    at === low ? reach[1] + 1 : at === high ? reach[0] + 1 : 0;

  for (const id of destroysAt.get(index) ?? []) {
    const at = participantIndex(diagram, id);
    if (at < 0) continue;
    const width = boxWidths[at];
    room += eaten(at, [Math.floor(width / 2), width - 1 - Math.floor(width / 2)]);
  }
  for (const id of createsAt.get(index) ?? []) {
    const at = participantIndex(diagram, id);
    if (at < 0) continue;
    room += eaten(at, markReach(kindOf(diagram, id), boxWidths[at]));
  }
  return room;
}

const markHeight = (diagram: SequenceDiagram, id: string): number => {
  const participant = diagram.participants.find((found) => found.id === id);
  return participant === undefined ? KIND_HEIGHT[DEFAULT_KIND] : nameHeight(participant);
};

function createdLater(flat: FlatEvent[], bound: Map<number, number>): Set<string> {
  const ids = new Set<string>();
  for (const index of bound.keys()) ids.add(createAt(flat, index).participant);
  return ids;
}

export function bindingsOf(flat: FlatEvent[]): Bindings {
  const boundDestroys = boundToMessage(flat, "destroy");
  const boundCreates = boundToMessage(flat, "create");
  return {
    boundDestroys,
    destroysAt: boundByMessage(flat, boundDestroys),
    boundCreates,
    createsAt: boundByMessage(flat, boundCreates),
    created: createdLater(flat, boundCreates),
  };
}

export function messagePad(
  diagram: SequenceDiagram,
  index: number,
  destroysAt: Map<number, string[]>,
  createsAt: Map<number, string[]>
): { push: number; below: number } {
  let push = destroysAt.has(index) ? 1 : 0;
  let below = destroysAt.has(index) ? 1 : 0;
  for (const id of createsAt.get(index) ?? []) {
    const kind = kindOf(diagram, id);
    const anchor = kindAnchor(kind);
    push = Math.max(push, Math.max(0, markHeight(diagram, id) - 1 - anchor - 1));
    below = Math.max(below, anchor);
  }
  return { push, below };
}
