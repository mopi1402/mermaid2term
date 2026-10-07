import { type Block, type SequenceDiagram, LEFT_OF, RIGHT_OF } from "./model.js";
import { colourToHex } from "../../colour/colours.js";
import { displayWidth } from "../../text/width.js";

import { type FlatEvent } from "./events.js";
import { CARTOUCHE_ROOM, NOTE_OFFSET, NOTE_PAD, participantIndex, noteWidth } from "./metrics.js";
import { selfSpan } from "./messages.js";
import { RECT } from "./patterns.js";
import { RECT_BACKGROUND } from "../../canvas/keys.js";
import { cartoucheText } from "./draw-blocks.js";

const FRAME_REACH = 6;

const FRAME_INDENT = 2;

const EMPTY_FRAME_RIGHT = 20;


const RECT_REACH = 1;

const TRANSPARENT = "transparent";

const frameAround = (left: number, right: number, depth: number): [number, number] => {
  const indent = depth * FRAME_INDENT;
  return [Math.max(0, left - FRAME_REACH) + indent, right + FRAME_REACH - indent];
};

const frameHeld = (bounds: [number, number], depth: number): [number, number] => {
  const indent = depth * FRAME_INDENT;
  return [(bounds[0]) - indent + FRAME_REACH, (bounds[1]) + indent - FRAME_REACH];
};

export function frameBounds(colCenters: number[], depth: number): [number, number] {
  if (colCenters.length === 0) return [depth * FRAME_INDENT, EMPTY_FRAME_RIGHT - depth * FRAME_INDENT];
  return frameAround(colCenters[0], colCenters[colCenters.length - 1], depth);
}

function eventSpan(
  diagram: SequenceDiagram,
  event: FlatEvent,
  index: number,
  colCenters: number[],
  labels: string[],
  labelled: boolean
): [number, number] | undefined {
  const centre = (id: string): number | undefined => {
    const at = participantIndex(diagram, id);
    return at < 0 ? undefined : (colCenters[at]);
  };

  if (event.type === "message") {
    const from = centre(event.source);
    const to = centre(event.target);
    if (from === undefined || to === undefined) return undefined;
    if (from === to) return selfSpan(from, labels[index]);
    return [Math.min(from, to), Math.max(from, to)];
  }

  if (event.type === "note") {
    let width = labelled ? noteWidth(event) : NOTE_PAD;
    const first = centre(event.participants[0]);
    if (first === undefined) return undefined;
    if (event.position === RIGHT_OF) return [first, first + NOTE_OFFSET + width - 1];
    if (event.position === LEFT_OF) return [Math.max(0, first - NOTE_OFFSET - width), first];
    let middle = first;
    if (event.participants.length === 2) {
      const second = centre(event.participants[1]);
      if (second === undefined) return undefined;
      middle = Math.floor((first + second) / 2);
      width = Math.max(width, Math.abs(first - second) + NOTE_PAD);
    }
    const at = Math.max(0, middle - Math.floor(width / 2));
    return [at, at + width - 1];
  }

  if (event.type === "activate" || event.type === "destroy" || event.type === "create") {
    const at = centre(event.participant);
    return at === undefined ? undefined : [at, at];
  }

  return undefined;
}

const cartoucheRoom = (block: Block): number =>
  block.kind === RECT
    ? 0
    : Math.max(
        displayWidth(cartoucheText(block.kind, block.label)),
        ...block.sections.map((section) => displayWidth(cartoucheText(section.kind, section.label)))
      ) + CARTOUCHE_ROOM;

export function blockSpans(
  diagram: SequenceDiagram,
  flat: FlatEvent[],
  colCenters: number[],
  labels: string[],
  labelled: boolean
): Map<number, [number, number]> {
  const bounds = new Map<number, [number, number]>();
  const open: Array<{ marks: number[]; depth: number; left: number; right: number }> = [];

  flat.forEach((event, index) => {
    if (event.type === "blockStart") {
      open.push({ marks: [index], depth: event.depth, left: Infinity, right: -Infinity });
      return;
    }
    if (event.type === "blockSection") {
      open[open.length - 1]?.marks.push(index);
      return;
    }
    if (event.type === "blockEnd") {
      const held = open.pop();
      if (held === undefined) return;
      held.marks.push(index);
      const full = frameBounds(colCenters, held.depth);
      const slab = event.block.kind === RECT;
      let [left, right] =
        held.left > held.right
          ? full
          : slab
            ? [Math.max(0, held.left - RECT_REACH), held.right + RECT_REACH]
            : frameAround(held.left, held.right, held.depth);

      const short = cartoucheRoom(event.block) - (right - left - 1);
      if (short > 0) {
        const lo = Math.min(full[0], left);
        const hi = Math.max(full[1], right);
        left = Math.max(lo, left - Math.ceil(short / 2));
        right = Math.min(hi, right + Math.floor(short / 2));
      }

      for (const mark of held.marks) bounds.set(mark, [Math.max(0, left), right]);
      // What a frame reaches AROUND is handed up, never the frame itself, or every level spends its own reach on the
      // level below it again.
      const [heldLeft, heldRight] = slab ? [left, right] : frameHeld([left, right], held.depth);
      for (const outer of open) {
        outer.left = Math.min(outer.left, heldLeft);
        outer.right = Math.max(outer.right, heldRight);
      }
      return;
    }
    const span = eventSpan(diagram, event, index, colCenters, labels, labelled);
    if (span === undefined) return;
    for (const held of open) {
      held.left = Math.min(held.left, span[0]);
      held.right = Math.max(held.right, span[1]);
    }
  });

  return bounds;
}

// A colour the `rect` names, or else the theme's own ground for it, which mermaid takes from `rectBkgColor`, then
// `actorBkg`, then a half grey: a name no colour parses from is read as unwritten, as mermaid's fill attribute drops it.
export const rectFill = (label: string): string | undefined => {
  const written = label.trim();
  if (written.toLowerCase() === TRANSPARENT) return undefined;
  return (written === "" ? undefined : colourToHex(written)) ?? RECT_BACKGROUND;
};

