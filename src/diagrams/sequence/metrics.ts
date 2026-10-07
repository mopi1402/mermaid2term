import { type Participant, type ParticipantBox, type ParticipantKind, type SequenceDiagram, type Note, DEFAULT_KIND } from "./model.js";
import { type CharSet } from "../../canvas/model.js";
import { NEWLINE } from "../../text/chars.js";
import { displayWidth } from "../../text/width.js";
import { labelRowsOf, widestLabelLine } from "../../text/labels.js";

export const BOX_PAD = 4;

export const BOX_HEIGHT = 3;

export const ACTOR_HEIGHT = 4;

export const BOUNDARY_HEIGHT = 2;

export const ENTITY_HEIGHT = 2;

export const CONTROL_HEIGHT = 2;

export const COLLECTIONS_HEIGHT = 4;

export const MIN_GAP = 16;

export const EVENT_ROW_H = 2;

export const BLOCK_START_H = 3;

export const BLOCK_SECTION_H = 3;

export const BLOCK_END_H = 2;

export const TOP_MARGIN = 0;

// The title row and the blank one under it, as every other kind that draws a `title` statement leaves.
export const TITLE_ROWS = 2;

export const BOTTOM_MARGIN = 1;

// The blank row a `box` leaves between the lifelines' end and its floor, its walls alone on it.
export const BOX_AIR = 1;

export const SYMBOL_HEIGHT = 5;

export const BOX_FRAME_PAD = 2;

const BOX_TITLE_ROOM = 4;

export const KIND_HEIGHT: Readonly<Record<ParticipantKind, number>> = {
  participant: 3,
  actor: 5,
  database: 5,
  queue: 5,
  boundary: 2,
  control: 2,
  entity: 2,
  collections: 4,
};

export const LINK_INSET = 1;

const KIND_ANCHOR: Readonly<Record<ParticipantKind, number>> = {
  participant: 1,
  actor: 2,
  database: 2,
  queue: 2,
  boundary: 1,
  control: 1,
  entity: 1,
  collections: 1,
};

export const KIND_REACH: Readonly<Partial<Record<ParticipantKind, readonly [number, number]>>> = {
  actor: [2, 2],
  database: [3, 2],
  queue: [5, 5],
  boundary: [2, 0],
  control: [0, 0],
  entity: [1, 1],
};

export const participantIndex = (diagram: SequenceDiagram, id: string): number =>
  diagram.participants.findIndex((participant) => participant.id === id);

const MEDALLION_CEILING = 100;

// Two cells per disc, one for the glyph and one kept empty beside it. The enclosed digits are AMBIGUOUS in
// Unicode's East Asian Width data, which is to say their width is a terminal setting and not a property of the
// character: a terminal reading them narrow squeezes a glyph drawn about one and a half cells wide into one and
// the number comes out shrunk and unbold, and a terminal reading them wide draws over the cell to the right. The
// empty cell answers both, the glyph keeping its own size and never landing on anything.
export const MEDALLION_COLS = 2;

export const medallion = (cs: CharSet, number: number): string | undefined => {
  if (number < 0 || number >= MEDALLION_CEILING) return undefined;
  if (Number.isInteger(number) && number >= 1 && number <= cs.medallions.length) return cs.medallions[number - 1];
  return [...String(number)].map((digit) => cs.discDigits[Number(digit)] ?? digit).join("");
};

export const labelLines = (label: string): string[] => (label === "" ? [] : labelRowsOf(label, NEWLINE));

export const titleRoom = (box: ParticipantBox): number => displayWidth(box.title) + BOX_TITLE_ROOM;

const kindHeight = (kind: ParticipantKind): number => KIND_HEIGHT[kind];

export const kindAnchor = (kind: ParticipantKind): number => KIND_ANCHOR[kind];

export const nameHeight = (participant: Participant): number =>
  kindHeight(participant.kind) + Math.max(0, labelLines(participant.label).length - 1) + linkRows(participant);

export const linkRows = (participant: Participant): number =>
  participant.links.length === 0 ? 0 : participant.links.length + (participant.kind === DEFAULT_KIND ? 1 : 0);

export const NOTE_PAD = 4;
export const NOTE_GAP_ROOM = 4;
export const NOTE_OFFSET = 2;
export const NOTE_FRAME_ROWS = 2;

export const CARTOUCHE_BAR = "|";
export const CARTOUCHE_ROOM = 2;
// A `rect` opens on a blank row, which its ground paints: the fill then breathes above the label the way it does
// under the arrow, rather than starting on the words.
export const RECT_START_H = 1;

export const RECT_END_H = 0;

export const LABEL_ROOM = 6;
export const LABEL_OFFSET = 2;

// mermaid writes nothing inside a queue or a database glyph, only the name under it.
export const QUEUE_SYMBOL_W = 11;

export const STACK_MARK = "+";

export const noteLines = (note: Note): string[] => labelRowsOf(note.text, NEWLINE);
export const noteWidth = (note: Note): number => widestLabelLine(note.text, NEWLINE) + NOTE_PAD;

