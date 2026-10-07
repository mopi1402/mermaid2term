import { type Message, type Note, type SequenceDiagram, OVER, RIGHT_OF } from "./model.js";
import { LABEL_ROOM, labelLines, NOTE_GAP_ROOM, participantIndex } from "./metrics.js";
import { widestLine } from "../../text/width.js";
import { type FlatEvent } from "./events.js";
import { computeLayout } from "./layout.js";
import { type Foldable, foldOnce, foldUntil, refolded, FOLD_GUARD } from "../../text/fold.js";
import { NEWLINE } from "../../text/chars.js";


type Held = Foldable & { readonly event: Message | Note };

function noteRoom(diagram: SequenceDiagram, centres: number[], note: Note): number {
  const first = participantIndex(diagram, note.participants[0] ?? "");
  if (first < 0) return 1;
  if (note.position === OVER) {
    if (note.participants.length !== 2) return 1;
    const second = participantIndex(diagram, note.participants[1]);
    if (second < 0) return 1;
    return Math.abs((centres[first]) - (centres[second]));
  }
  const beside = note.position === RIGHT_OF ? first : first - 1;
  if (beside < 0 || beside >= centres.length - 1) return 1;
  return (centres[beside + 1]) - (centres[beside]) - NOTE_GAP_ROOM;
}

// A label carries `wrap: true` when its source asked to fold and `false` when it forbade it, as mermaid's
// `extractWrap` reads the prefix. `nowrap:` keeps a label off the folding list altogether; `wrap:` folds it to the
// room between its two lifelines before the budget is even looked at, which is mermaid's own fixed `conf.width`
// read on a grid. The budget is undefined when only those two have work to do.
export const asksToFold = (event: FlatEvent): boolean =>
  (event.type === "message" || event.type === "note") && event.wrap !== undefined;

export function foldForBudget(
  diagram: SequenceDiagram,
  flat: FlatEvent[],
  paddingX: number,
  gap: number,
  budget: number | undefined
): void {
  const bare = computeLayout(diagram, flat, paddingX, gap, false);
  const folding: Held[] = [];
  // Folds are written to copies held only by `flat`, never to the parsed diagram.
  for (const [index, held] of flat.entries()) {
    if (held.type === "message") {
      if (held.source === held.target || held.label === "" || held.wrap === false) continue;
      const source = participantIndex(diagram, held.source);
      const target = participantIndex(diagram, held.target);
      if (source < 0 || target < 0) continue;
      const low = Math.min(source, target);
      const high = Math.max(source, target);
      const room = (bare.colCenters[high]) - (bare.colCenters[low]) - LABEL_ROOM;
      const event: Message = { ...held };
      flat[index] = event;
      folding.push({
        event,
        read: () => event.label,
        write: (text) => {
          event.label = text;
        },
        room: Math.max(1, room),
        original: event.label,
        notch: 1,
      });
      continue;
    }
    if (held.type !== "note" || held.text === "" || held.wrap === false) continue;
    const event: Note = { ...held };
    flat[index] = event;
    folding.push({
      event,
      read: () => event.text,
      write: (text) => {
        event.text = text;
      },
      room: Math.max(1, noteRoom(diagram, bare.colCenters, event)),
      original: event.text,
      notch: 1,
    });
  }

  const relaxOnce = (held: Held, ceiling: number): boolean => {
    if (held.event.wrap === true) return false;
    const lines = labelLines(held.read()).length;
    if (lines <= 1) return false;
    const full = widestLine(held.original);
    for (let target = widestLine(held.read()) + 1; target <= full; target++) {
      const candidate = refolded(held.original, target, NEWLINE);
      if (labelLines(candidate).length >= lines) continue;
      const folded = held.read();
      held.write(candidate);
      if (computeLayout(diagram, flat, paddingX, gap).width <= ceiling) return true;
      held.write(folded);
      return false;
    }
    return false;
  };

  for (const held of folding) if (held.event.wrap === true) foldOnce(held, NEWLINE);

  if (budget === undefined) return;

  foldUntil(folding, budget, () => computeLayout(diagram, flat, paddingX, gap).width, NEWLINE);

  const settled = computeLayout(diagram, flat, paddingX, gap).width;
  const ceiling = Math.max(budget, settled);
  for (let guard = 0; guard < FOLD_GUARD; guard++) {
    let gained = false;
    for (const held of folding) if (relaxOnce(held, ceiling)) gained = true;
    if (!gained) break;
  }
}
