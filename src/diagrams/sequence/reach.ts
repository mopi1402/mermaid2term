import { type SequenceDiagram, OVER, RIGHT_OF, type BoxFrame } from "./model.js";
import { must } from "../../must.js";
import { type FlatEvent } from "./events.js";
import { selfSpan } from "./messages.js";
import { NOTE_OFFSET, NOTE_PAD, participantIndex, noteWidth } from "./metrics.js";

export function widestReach(
  diagram: SequenceDiagram,
  flat: FlatEvent[],
  colCenters: number[],
  boxWidths: number[],
  boxFrames: BoxFrame[],
  blockFrames: Map<number, [number, number]>,
  labels: string[],
  labelled: boolean
): number {
  const n = diagram.participants.length;
  let maxRight = (colCenters[n - 1]) + Math.floor((boxWidths[n - 1]) / 2) + 2;
  for (const [index, event] of flat.entries()) {
    if (event.type === "message") {
      const at = participantIndex(diagram, event.source);
      if (at >= 0 && at === participantIndex(diagram, event.target)) {
        maxRight = Math.max(maxRight, (selfSpan(colCenters[at], labels[index])[1]) + 2);
      }
      continue;
    }

    if (event.type === "note") {
      const width = labelled ? noteWidth(event) : NOTE_PAD;
      for (const id of event.participants) {
        const at = participantIndex(diagram, id);
        if (at >= 0 && event.position === RIGHT_OF) {
          maxRight = Math.max(maxRight, (colCenters[at]) + NOTE_OFFSET + width + 1);
        }
      }
      if (event.position !== OVER) continue;

      if (event.participants.length === 2) {
        const first = participantIndex(diagram, event.participants[0]);
        const second = participantIndex(diagram, event.participants[1]);
        if (first < 0 || second < 0) continue;
        const centre = Math.floor(((colCenters[first]) + (colCenters[second])) / 2);
        const spanned = Math.abs((colCenters[first]) - (colCenters[second])) + NOTE_PAD;
        const drawn = Math.max(width, spanned);
        maxRight = Math.max(maxRight, Math.max(0, centre - Math.floor(drawn / 2)) + drawn + 1);
      } else if (event.participants.length === 1) {
        const at = participantIndex(diagram, event.participants[0]);
        if (at < 0) continue;
        const left = Math.max(0, (colCenters[at]) - Math.floor(width / 2));
        maxRight = Math.max(maxRight, left + width + 1);
      }
      continue;
    }

    if (event.type === "blockStart") {
      maxRight = Math.max(maxRight, (must(blockFrames.get(index)))[1] + 1);
    }
  }

  for (const frame of boxFrames) maxRight = Math.max(maxRight, frame.right + 1);
  return maxRight;
}
