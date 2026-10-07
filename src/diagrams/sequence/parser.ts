import { withoutAccessible } from "../@common/accessible.js";
import { applyRules, type LineRule } from "../@common/rules.js";
import { splitColour } from "../../colour/colours.js";
import {
  DEFAULT_KIND,
  makeParticipant,
  makeSequenceDiagram,
  NOTE_POSITIONS,
  PARTICIPANT_KINDS,
  SECTION_KINDS,
  type Block,
  type BlockSection,
  type ParticipantKind,
  type Event,
  type ParticipantBox,
  type SequenceDiagram,
} from "./model.js";
import { BR_RE } from "../../text/labels.js";
import { terminalUrl } from "../../text/width.js";
import { NEWLINE, SPACE } from "../../text/chars.js";
import { must, oneOf } from "../../must.js";
import { flagOf, type Declared } from "../../source/config.js";
import { COMMENT, SEMICOLON, headerTail } from "../../source/lines.js";
import { splitOutsideQuotes } from "../../source/quotes.js";
import { BLOCK_OPEN, joinedBlocks } from "../../source/shape-data.js";
import { ACTIVATE, ACTIVATE_MARKER, ACTIVATE_RE, AUTONUMBER_RE, extractWrap, BLOCK_END_RE, BLOCK_SECTION_RE, BLOCK_START_RE, BOX_START_RE, CONFIG_ALIAS_RE, CONFIG_TYPE_RE, DEACTIVATE_MARKER, DESTROY_RE, HEADER_RE, LINKS_RE, LINK_RE, MESSAGE_RE, NOTE_RE, PARTICIPANT_CONFIG_RE, PARTICIPANT_KIND_RE, POSITION_SPACE_RE, TITLE_RE, arrowOf, blockKindOf, leadingDot, splitMarker, trailingDot } from "./patterns.js";

const EQUALS_ENTITY_RE = /&equals;/gu;
const AMP_ENTITY_RE = /&amp;/gu;

// mermaid unescapes exactly these two before reading a `link` or `links` payload, label and url alike.
const unescapedLink = (written: string): string => written.replace(EQUALS_ENTITY_RE, "=").replace(AMP_ENTITY_RE, "&");

// mermaid's sequence lexer skips a `#` to the end of the line; only a whole line is taken here, a trailing
// one being what cuts `#9829;` out of a message in mermaid itself.
const HASH_COMMENT = "#";

// A `;` closing an entity is part of the word, not a separator: `#59;` for a semicolon and `#9829;` for a heart
// are the ones this parser is asked to keep, `&amp;` and `&equals;` the ones mermaid's own sanitizer writes into a
// source it can no longer read itself, and `unescapedLink` exists to undo exactly that.
const ENTITY_TAIL_RE = /[#&]\w+$/u;

// mermaid's sequence lexer returns a NEWLINE for a `;` (rule 59 of `sequenceDiagram.jison`), so a statement ends
// there as surely as at a line break, and every text rule stops at it. A `@{...}` config is the one place it does
// not: mermaid's CONFIG state has no `;` rule and reads the braces whole.
const statements = (lines: string[]): string[] =>
  lines.flatMap((line) => {
    if (line.includes(BLOCK_OPEN)) return [line];
    const out: string[] = [];
    for (const part of splitOutsideQuotes(line, SEMICOLON)) {
      const last = out[out.length - 1];
      if (last !== undefined && ENTITY_TAIL_RE.test(last)) out[out.length - 1] = `${last}${SEMICOLON}${part}`;
      else out.push(part);
    }
    return out;
  });

function nameParticipant(diagram: SequenceDiagram, id: string, label: string, kind: ParticipantKind): void {
  const existing = diagram.participants.find((participant) => participant.id === id);
  if (existing === undefined) diagram.participants.push(makeParticipant(id, label, kind));
  else {
    existing.label = label;
    existing.kind = kind;
  }
}

function addLinks(diagram: SequenceDiagram, id: string, pairs: Array<[string, string]> | undefined, line: string): void {
  const participant = diagram.participants.find((p) => p.id === id);
  if (participant === undefined || pairs === undefined) {
    diagram.warnings.push(`Unrecognized line: ${JSON.stringify(line)}`);
    return;
  }
  for (const [label, url] of pairs) {
    const known = participant.links.find((link) => link.label === label);
    if (known !== undefined) known.url = terminalUrl(url);
    else participant.links.push({ label, url: terminalUrl(url) });
  }
}

function ensureParticipant(diagram: SequenceDiagram, id: string): void {
  if (!diagram.participants.some((participant) => participant.id === id)) {
    diagram.participants.push(makeParticipant(id, id));
  }
}

// What the statements read so far have opened: the event list a statement lands in, the blocks and the box.
interface Reading {
  readonly diagram: SequenceDiagram;
  // `wrap` says how a label folds where the label says nothing itself, which is what `wrap:` and `nowrap:` say
  // one message at a time.
  readonly folds: boolean | undefined;
  readonly eventStack: Event[][];
  readonly blockStack: Block[];
  openBox: ParticipantBox | undefined;
}

const target = (reading: Reading): Event[] => reading.eventStack[reading.eventStack.length - 1];

// A declared participant takes its name, joins the open box, and is created there when the line says so.
function declare(reading: Reading, id: string, label: string, kind: ParticipantKind, created: boolean): void {
  nameParticipant(reading.diagram, id, label, kind);
  reading.openBox?.participants.push(id);
  if (created) target(reading).push({ type: "create", participant: id });
}

const labelOf = (written: string): string => extractWrap(written.trim())[0].replace(BR_RE, NEWLINE);

function linksOf(written: string): Array<[string, string]> | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(unescapedLink(written));
  } catch {
    parsed = undefined;
  }
  return parsed !== undefined && typeof parsed === "object"
    ? Object.entries(parsed as Record<string, unknown>).filter((pair): pair is [string, string] => typeof pair[1] === "string") // boundary: JSON.parse's object
    : undefined;
}

function closeBlock(reading: Reading): void {
  if (reading.openBox !== undefined && reading.blockStack.length === 0) {
    reading.openBox = undefined;
    return;
  }
  if (reading.blockStack.length > 0) {
    reading.blockStack.pop();
    reading.eventStack.pop();
  }
}

function openSection(reading: Reading, found: RegExpExecArray): void {
  const opened: BlockSection = {
    kind: must(oneOf(SECTION_KINDS, found[1].toLowerCase())),
    label: extractWrap(found[2].trim())[0],
    events: [],
  };
  reading.blockStack[reading.blockStack.length - 1].sections.push(opened);
  reading.eventStack[reading.eventStack.length - 1] = opened.events;
}

function openBlock(reading: Reading, found: RegExpExecArray): void {
  const block: Block = {
    type: "block",
    kind: blockKindOf(found[1]),
    label: extractWrap(found[2].trim())[0],
    events: [],
    sections: [],
  };
  target(reading).push(block);
  reading.blockStack.push(block);
  reading.eventStack.push(block.events);
}

function addNote(reading: Reading, found: RegExpExecArray): void {
  const first = found[2];
  const second = found[3];
  const participants = second === undefined ? [first] : [first, second];
  for (const id of participants) ensureParticipant(reading.diagram, id);
  const [noteText, written] = extractWrap(found[4].trim());
  const noteWrap = written ?? reading.folds;
  target(reading).push({
    type: "note",
    text: noteText.replace(BR_RE, NEWLINE),
    ...(noteWrap === undefined ? {} : { wrap: noteWrap }),
    position: must(oneOf(NOTE_POSITIONS, found[1].toLowerCase().replace(POSITION_SPACE_RE, ""))),
    participants,
  });
}

function declareConfigured(reading: Reading, found: RegExpExecArray): void {
  const id = found[2];
  const body = found[3];
  const typed = CONFIG_TYPE_RE.exec(body)?.[1]?.toLowerCase() ?? undefined;
  const kind = (typed === undefined ? undefined : oneOf(PARTICIPANT_KINDS, typed)) ?? DEFAULT_KIND;
  const aliased = CONFIG_ALIAS_RE.exec(body) ?? undefined;
  declare(reading, id, labelOf(found[4] ?? aliased?.[1] ?? aliased?.[2] ?? aliased?.[3] ?? id), kind, found[1] !== undefined);
}

function addMessage(reading: Reading, found: RegExpExecArray): void {
  const { diagram } = reading;
  const [written, dotSource] = trailingDot(found[1]);
  const [writtenTarget, dotTarget] = leadingDot(found[3]);
  const [source, sourceMarker] = splitMarker(written);
  const [messageTarget, targetMarker] = splitMarker(writtenTarget);

  ensureParticipant(diagram, source);
  ensureParticipant(diagram, messageTarget);
  const arrow = arrowOf(found[2]);
  const [spelled, saidWrap] = extractWrap(found[4] === undefined ? "" : found[4].trim());
  const wrap = saidWrap ?? reading.folds;
  const events = target(reading);
  events.push({
    type: "message",
    source,
    target: messageTarget,
    label: spelled.replace(BR_RE, NEWLINE),
    ...(wrap === undefined ? {} : { wrap }),
    lineType: arrow.line,
    arrowType: arrow.head,
    ...(arrow.half === undefined ? {} : { half: arrow.half }),
    ...(arrow.reversed === undefined ? {} : { reversed: arrow.reversed }),
    ...(dotSource ? { dotSource: true as const } : {}),
    ...(dotTarget ? { dotTarget: true as const } : {}),
  });

  if (sourceMarker !== "") {
    events.push({ type: "activate", participant: source, active: sourceMarker === ACTIVATE_MARKER });
  }
  if (targetMarker === ACTIVATE_MARKER) {
    events.push({ type: "activate", participant: messageTarget, active: true });
  } else if (targetMarker === DEACTIVATE_MARKER) {
    events.push({ type: "activate", participant: source, active: false });
  }
}

// The statements, in the order they are tried.
const RULES: ReadonlyArray<LineRule<Reading>> = [
  { pattern: TITLE_RE, apply: ({ diagram }, found) => { diagram.title = found[1]; } },
  {
    pattern: LINK_RE,
    apply: ({ diagram }, found, line) => addLinks(diagram, found[1], [[unescapedLink(found[2]), unescapedLink(found[3])]], line),
  },
  { pattern: LINKS_RE, apply: ({ diagram }, found, line) => addLinks(diagram, found[1], linksOf(found[2]), line) },
  {
    pattern: AUTONUMBER_RE,
    apply: (reading, found) =>
      target(reading).push({
        type: "autonumber",
        start: found[1] === undefined ? undefined : Number(found[1]),
        step: found[2] === undefined ? undefined : Number(found[2]),
        visible: found[3] === undefined,
      }),
  },
  { pattern: BLOCK_END_RE, apply: closeBlock },
  { pattern: BLOCK_SECTION_RE, when: (reading) => reading.blockStack.length > 0, apply: openSection },
  {
    pattern: BOX_START_RE,
    apply: (reading, found) => {
      const [colour, written] = splitColour(found[1].trim());
      reading.openBox = { colour, title: extractWrap(written)[0], participants: [] };
      reading.diagram.boxes.push(reading.openBox);
    },
  },
  { pattern: BLOCK_START_RE, apply: openBlock },
  {
    pattern: ACTIVATE_RE,
    apply: (reading, found) => {
      ensureParticipant(reading.diagram, found[2]);
      target(reading).push({ type: "activate", participant: found[2], active: found[1].toLowerCase() === ACTIVATE });
    },
  },
  { pattern: NOTE_RE, apply: addNote },
  {
    pattern: DESTROY_RE,
    apply: (reading, found) => {
      ensureParticipant(reading.diagram, found[1]);
      target(reading).push({ type: "destroy", participant: found[1] });
    },
  },
  { pattern: PARTICIPANT_CONFIG_RE, apply: declareConfigured },
  {
    pattern: PARTICIPANT_KIND_RE,
    apply: (reading, found) => {
      const kind = must(oneOf(PARTICIPANT_KINDS, found[2].toLowerCase()));
      declare(reading, found[3], found[4] === undefined ? found[3] : labelOf(found[4]), kind, found[1] !== undefined);
    },
  },
  { pattern: MESSAGE_RE, apply: addMessage },
];

export function parseSequenceDiagram(text: string, said: Declared = {}): SequenceDiagram {
  const diagram = makeSequenceDiagram();
  // `showSequenceNumbers` is `autonumber` written in the config rather than in the body: mermaid holds the
  // numbering in the message stream, so the config is an autonumber standing before every statement, which a
  // later `autonumber off` turns back off exactly as it would one written by hand.
  if (flagOf(said, "showSequenceNumbers") === true) {
    diagram.events.push({ type: "autonumber", start: undefined, step: undefined, visible: true });
  }
  const reading: Reading = { diagram, folds: flagOf(said, "wrap"), eventStack: [diagram.events], blockStack: [], openBox: undefined };

  let headed = false;
  for (const line of statements(joinedBlocks(withoutAccessible(text.split(NEWLINE)), SPACE))) {
    // mermaid reads a statement on the header line too: `sequenceDiagram A->>B: hi`.
    const written = line.trim();
    const tail = headed ? undefined : headerTail(written, HEADER_RE);
    if (tail !== undefined) headed = true;
    const stripped = tail ?? written;

    if (stripped === "" || stripped.startsWith(COMMENT) || stripped.startsWith(HASH_COMMENT)) continue;
    if (!applyRules(RULES, reading, stripped)) diagram.warnings.push(`Unrecognized line: ${JSON.stringify(stripped)}`);
  }

  if (flagOf(said, "hideUnusedParticipants") === true) dropUnused(diagram);
  return diagram;
}

// mermaid keeps the actors some entry of its message list names as `from` or `to`: a message, a note, an activation.
function namedIn(events: Event[], into: Set<string>): Set<string> {
  for (const event of events) {
    if (event.type === "message") into.add(event.source).add(event.target);
    else if (event.type === "note") for (const id of event.participants) into.add(id);
    else if (event.type === "activate") into.add(event.participant);
    else if (event.type === "block") {
      namedIn(event.events, into);
      for (const section of event.sections) namedIn(section.events, into);
    }
  }
  return into;
}

function withoutUnused(events: Event[], used: Set<string>): Event[] {
  return events.flatMap((event): Event[] => {
    if (event.type === "create" || event.type === "destroy") return used.has(event.participant) ? [event] : [];
    if (event.type !== "block") return [event];
    event.events = withoutUnused(event.events, used);
    for (const section of event.sections) section.events = withoutUnused(section.events, used);
    return [event];
  });
}

function dropUnused(diagram: SequenceDiagram): void {
  const used = namedIn(diagram.events, new Set());
  diagram.participants = diagram.participants.filter((participant) => used.has(participant.id));
  for (const box of diagram.boxes) box.participants = box.participants.filter((id) => used.has(id));
  diagram.boxes = diagram.boxes.filter((box) => box.participants.length > 0);
  diagram.events = withoutUnused(diagram.events, used);
}

