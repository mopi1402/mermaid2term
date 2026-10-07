import { type Block, type BlockSection, type CreateEvent, type Event, type Message, type ParticipantKind, type SequenceDiagram, DEFAULT_KIND } from "./model.js";

export interface BlockStart {
  type: "blockStart";
  block: Block;
  depth: number;
}

export interface BlockSectionBreak {
  type: "blockSection";
  section: BlockSection;
  depth: number;
}

interface BlockEnd {
  type: "blockEnd";
  block: Block;
  depth: number;
}

export type FlatEvent = Exclude<Event, Block> | BlockStart | BlockSectionBreak | BlockEnd;

export const createAt = (flat: FlatEvent[], index: number): CreateEvent => {
  const event = flat[index];
  if (event.type !== "create") throw new Error(`a creation was expected at ${index}, not a ${event.type}`);
  return event;
};

export const messageAt = (flat: FlatEvent[], index: number): Message => {
  const event = flat[index];
  if (event.type !== "message") throw new Error(`a message was expected at ${index}, not a ${event.type}`);
  return event;
};

export const participantOf = (event: FlatEvent): string => {
  if (event.type !== "create" && event.type !== "destroy") throw new Error(`a creation or destruction was expected, not a ${event.type}`);
  return event.participant;
};

export function flattenEvents(events: Event[], depth = 0): FlatEvent[] {
  const flat: FlatEvent[] = [];
  for (const event of events) {
    if (event.type !== "block") {
      flat.push(event);
      continue;
    }
    flat.push({ type: "blockStart", block: event, depth });
    flat.push(...flattenEvents(event.events, depth + 1));
    for (const section of event.sections) {
      flat.push({ type: "blockSection", section, depth });
      flat.push(...flattenEvents(section.events, depth + 1));
    }
    flat.push({ type: "blockEnd", block: event, depth });
  }
  return flat;
}

export const kindOf = (diagram: SequenceDiagram, id: string): ParticipantKind =>
  diagram.participants.find((participant) => participant.id === id)?.kind ?? DEFAULT_KIND;
