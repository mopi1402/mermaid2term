export const PARTICIPANT_KINDS = ["participant", "actor", "database", "queue", "boundary", "control", "entity", "collections"] as const;
export type ParticipantKind = (typeof PARTICIPANT_KINDS)[number];

export const SOLID = "solid";
export const DOTTED = "dotted";
export type LineType = typeof SOLID | typeof DOTTED;

const ARROW_TYPES = ["arrow", "cross", "open", "async", "bidirectional", "half", "stick"] as const;
export type ArrowType = (typeof ARROW_TYPES)[number];

export const TOP = "top";
export const BOTTOM = "bottom";
export type Half = typeof TOP | typeof BOTTOM;

export const RIGHT_OF = "rightof";
export const LEFT_OF = "leftof";
export const OVER = "over";
export const NOTE_POSITIONS = [RIGHT_OF, LEFT_OF, OVER] as const;
type NotePosition = (typeof NOTE_POSITIONS)[number];

export const BLOCK_KINDS = ["loop", "alt", "opt", "par", "critical", "break", "rect"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
export const SECTION_KINDS = ["else", "and", "option"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export interface Participant {
  id: string;
  label: string;
  kind: ParticipantKind;
  links: ParticipantLink[];
}

interface ParticipantLink {
  label: string;
  url: string | undefined;
}

export interface Message {
  type: "message";
  source: string;
  target: string;
  label: string;
  lineType: LineType;
  arrowType: ArrowType;
  half?: Half;
  reversed?: true;
  dotSource?: true;
  dotTarget?: true;
  wrap?: boolean;
}

export interface Note {
  type: "note";
  text: string;
  position: NotePosition;
  participants: string[];
  wrap?: boolean;
}

interface ActivateEvent {
  type: "activate";
  participant: string;
  active: boolean;
}

interface DestroyEvent {
  type: "destroy";
  participant: string;
}

// mermaid holds `autonumber` in the message stream itself (`apply`, case "sequenceIndex"), so a statement numbers
// the messages under it and nothing above, and the running count keeps going whether the numbers show or not.
interface AutonumberEvent {
  type: "autonumber";
  start: number | undefined;
  step: number | undefined;
  visible: boolean;
}

export interface CreateEvent {
  type: "create";
  participant: string;
}

export interface ParticipantBox {
  colour: string | undefined;
  title: string;
  participants: string[];
}

export interface BlockSection {
  kind: SectionKind;
  label: string;
  events: Event[];
}

export interface Block {
  type: "block";
  kind: BlockKind;
  label: string;
  events: Event[];
  sections: BlockSection[];
}

export type Event = Message | Note | ActivateEvent | Block | DestroyEvent | CreateEvent | AutonumberEvent;

export interface SequenceDiagram {
  title: string;
  participants: Participant[];
  boxes: ParticipantBox[];
  events: Event[];
  warnings: string[];
}

export const DEFAULT_KIND: ParticipantKind = "participant";

export const makeParticipant = (id: string, label: string, kind: ParticipantKind = DEFAULT_KIND): Participant => ({
  id,
  label,
  kind,
  links: [],
});

export const makeSequenceDiagram = (): SequenceDiagram => ({
  title: "",
  participants: [],
  boxes: [],
  events: [],
  warnings: [],
});

export interface BoxFrame {
  title: string;
  left: number;
  right: number;
  fill: string | undefined;
}
// Each `create` and `destroy` held to the first message after it that names its participant, by event index; the
// participants each such message brings in or takes out; and every participant created on the way.
export interface Bindings {
  readonly boundDestroys: Map<number, number>;
  readonly destroysAt: Map<number, string[]>;
  readonly boundCreates: Map<number, number>;
  readonly createsAt: Map<number, string[]>;
  readonly created: Set<string>;
}

export interface Layout {
  bindings: Bindings;
  colCenters: number[];
  boxWidths: number[];
  width: number;
  height: number;
  headerHeight: number;
  rowOffsets: number[];
  headerTop: number;
  boxCeiling: number;
  boxFrames: BoxFrame[];
  blockFrames: Map<number, [number, number]>;
}
