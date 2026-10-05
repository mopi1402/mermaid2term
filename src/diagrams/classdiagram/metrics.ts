import {
  type ClassDef,
  type Note,
  type Relationship,
} from "./model.js";
import { labelRowsOf } from "../../text/labels.js";
import { displayWidth } from "../../text/width.js";
import { stampedWidth } from "../../canvas/chip.js";
import { NUL, SPACE } from "../../text/chars.js";
import { Direction } from "../../graph/model.js";
import { type Layout } from "./model.js";

export const { RL, BT } = Direction;

export const CLASS_PAD = 2;

export const MIN_BOX_WIDTH = 16;

export const LAYER_GAP = 4;

export const MIN_EDGE_GAP = 4;

export const MARGIN = 2;

export const LABEL_ROOM = 4;

export const EXIT_SPREAD = 3;

// An arrival spreads narrower than an exit: it has one wall to land on, not a whole side to fan across.
export const ARRIVAL_SPREAD = 2;

// The two columns a self relation's loop rides outside the box it leaves and comes back to.
export const SELF_ARM = 2;

export const loopSideOf = (layout: Layout, name: string): number => layout.loops.get(name) ?? 1;

// The two rows a self relation rides on its wall.
export const loopRows = (sy: number, sh: number): readonly [number, number] => [sy + Math.min(1, sh - 1), sy + Math.min(3, Math.max(2, sh - 2))];

export const NOTE_PAD = 2;

export const NOTE_ROOM = 2;

export const NOTE_TETHER = 4;

export const BLOCK_PREFIX = `${NUL}ns`;

export const LAYER_STRIDE = 1000;

export function exitRuns(relationships: Relationship[]): Map<string, number> {
  const runs = new Map<string, number>();
  for (const rel of relationships) {
    runs.set(rel.source, Math.max(runs.get(rel.source) ?? 0, Math.max(RUN_LEAST, displayWidth(rel.sourceCard))));
  }
  return runs;
}

export const acrossRoom = (rel: Relationship, exitRun: number): number =>
  Math.max(exitRun + 2 + Math.max(displayWidth(rel.targetCard), rel.label === "" ? 0 : stampedWidth(rel.label) + 2), cardRoom(rel, CARD_APART));

// A cardinal stands ON the wall it belongs to: the wall is an eighth of a cell and already reads as the air a
// blank would add. What two cardinals facing each other across the gap keep is three cells, two once the page runs
// out of width, since one between them reads as none at all. The run a cardinal is written on is never shorter.
const RUN_LEAST = 2;
const CARD_APART = 3;
const CARD_APART_TIGHT = 2;

const cardRoom = (rel: Relationship, apart: number): number => {
  const source = displayWidth(rel.sourceCard);
  const target = displayWidth(rel.targetCard);
  return source + target + (source > 0 && target > 0 ? apart : 0);
};

// The least a relation can take across the gap and still say what it is: the label chip with one run cell on each
// side of it, the head standing on the outer one, and the cardinals kept off the walls and off each other. A relation
// carrying neither asks what it always asked: there is no comfort around a label it does not have. One that TURNS
// writes its chip past the bend, so the run it leaves by is owed on top.
export const tightRoom = (rel: Relationship, exitRun: number, bends: boolean): number => {
  const chip = rel.label === "" ? 0 : stampedWidth(rel.label) + (bends ? exitRun + 4 : 3);
  return Math.max(exitRun + 2, chip, cardRoom(rel, CARD_APART_TIGHT));
};

export const KEY_SEP = SPACE;

export const SIDE_SIDE = "side";

export const SIDE_BOTTOM = "bottom";

export const SIDE_LEFT = "<";

export const SIDE_RIGHT = ">";

export const nameLines = (cls: ClassDef): string[] => labelRowsOf(cls.label);

// mermaid reads these rows as markdown, so a row is as wide as its letters, never as wide as the markers the
// author wrote around them.

export const noteLines = (note: Note): string[] => labelRowsOf(note.text);
