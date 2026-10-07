import { must, oneOf } from "../../must.js";
import {
  BLOCK_KINDS,
  BOTTOM,
  DOTTED,
  PARTICIPANT_KINDS,
  SECTION_KINDS,
  SOLID,
  TOP,
  type ArrowType,
  type BlockKind,
  type Half,
  type LineType,
} from "./model.js";

interface Arrow {
  readonly line: LineType;
  readonly head: ArrowType;
  readonly half?: Half;
  readonly reversed?: true;
}

const ARROW_PATTERNS: ReadonlyMap<string, Arrow> = new Map([
  ["<<-->>", { line: DOTTED, head: "bidirectional" }],
  ["<<->>", { line: SOLID, head: "bidirectional" }],
  ["-->>", { line: DOTTED, head: "arrow" }],
  ["->>", { line: SOLID, head: "arrow" }],
  ["--x", { line: DOTTED, head: "cross" }],
  ["-x", { line: SOLID, head: "cross" }],
  ["--)", { line: DOTTED, head: "async" }],
  ["-)", { line: SOLID, head: "async" }],
  ["-->", { line: DOTTED, head: "open" }],
  ["->", { line: SOLID, head: "open" }],
  ["-|\\", { line: SOLID, head: "half", half: TOP }],
  ["-|/", { line: SOLID, head: "half", half: BOTTOM }],
  ["--|\\", { line: DOTTED, head: "half", half: TOP }],
  ["--|/", { line: DOTTED, head: "half", half: BOTTOM }],
  ["-\\\\", { line: SOLID, head: "stick", half: TOP }],
  ["-//", { line: SOLID, head: "stick", half: BOTTOM }],
  ["--\\\\", { line: DOTTED, head: "stick", half: TOP }],
  ["--//", { line: DOTTED, head: "stick", half: BOTTOM }],
  ["/|-", { line: SOLID, head: "half", half: TOP, reversed: true }],
  ["\\|-", { line: SOLID, head: "half", half: BOTTOM, reversed: true }],
  ["/|--", { line: DOTTED, head: "half", half: TOP, reversed: true }],
  ["\\|--", { line: DOTTED, head: "half", half: BOTTOM, reversed: true }],
  ["//-", { line: SOLID, head: "stick", half: TOP, reversed: true }],
  ["\\\\-", { line: SOLID, head: "stick", half: BOTTOM, reversed: true }],
  ["//--", { line: DOTTED, head: "stick", half: TOP, reversed: true }],
  ["\\\\--", { line: DOTTED, head: "stick", half: BOTTOM, reversed: true }],
]);

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ARROWS = [...ARROW_PATTERNS.keys()]
  .sort((one, two) => two.length - one.length)
  .map(escaped)
  .join("|");

// An id may hold spaces, as mermaid's ACTOR rule does: it runs to the arrow, the comma or the colon.
export const MESSAGE_RE = new RegExp(String.raw`^\s*(.+?)\s*(${ARROWS})\s*(.+?)\s*(?::\s*(.*?))?\s*$`, "u");

export const PARTICIPANT_KIND_RE = new RegExp(
  String.raw`^\s*(create\s+)?(${PARTICIPANT_KINDS.join("|")})\s+(.+?)(?:\s+as\s+(.+?))?\s*$`,
  "iu"
);

export const PARTICIPANT_CONFIG_RE =
  /^\s*(create\s+)?(?:participant|actor)\s+([^@]+?)@\{(.*)\}(?:\s+as\s+(.+?))?\s*$/iu;

export const CONFIG_TYPE_RE = /["']?type["']?\s*:\s*["']?([a-z]+)["']?/iu;

export const CONFIG_ALIAS_RE = /["']?alias["']?\s*:\s*(?:"([^"]*)"|'([^']*)'|([^,}]+))/iu;

export const LINK_RE = /^link\s+([^:]+?)\s*:\s*(.+?)\s*@\s*(\S+)\s*$/iu;

export const LINKS_RE = /^links\s+([^:]+?)\s*:\s*(\{.*\})\s*$/iu;

export const NOTE_RE = /^\s*Note\s+(right\s+of|left\s+of|over)\s+([^,:]+?)(?:\s*,\s*([^,:]+?))?\s*:\s*(.*?)\s*$/iu;

const BLOCK_ALIASES: ReadonlyMap<string, BlockKind> = new Map([["par_over", "par"]]);

export const BLOCK_START_RE = new RegExp(
  String.raw`^\s*(${[...BLOCK_ALIASES.keys(), ...BLOCK_KINDS].join("|")})\b\s*(.*?)\s*$`,
  "iu"
);

export const blockKindOf = (written: string): BlockKind => {
  const lower = written.toLowerCase();
  return BLOCK_ALIASES.get(lower) ?? must(oneOf(BLOCK_KINDS, lower));
};

export const BOX_START_RE = /^\s*box\b\s*(.*?)\s*$/iu;

export const BLOCK_SECTION_RE = new RegExp(String.raw`^\s*(${SECTION_KINDS.join("|")})\b\s*(.*?)\s*$`, "iu");

export const BLOCK_END_RE = /^\s*end\s*$/iu;

export const ACTIVATE_RE = /^\s*(activate|deactivate)\s+(.+?)\s*$/iu;

export const DESTROY_RE = /^\s*destroy\s+(.+?)\s*$/iu;

export const HEADER_RE = /^sequenceDiagram(?=\s|$)/u;

export const TITLE_RE = /^title(?::)?\s(.+?)\s*$/iu;

// mermaid's NUM token: `[0-9]+(\.[0-9]{1,2})?|\.[0-9]{1,2}`.
const NUM = String.raw`\d+(?:\.\d{1,2})?|\.\d{1,2}`;
export const AUTONUMBER_RE = new RegExp(String.raw`^autonumber(?:\s+(${NUM})(?:\s+(${NUM}))?|\s+(off))?$`, "iu");

export const ACTIVATE = "activate";

export const ACTIVATE_MARKER = "+";

export const DEACTIVATE_MARKER = "-";

const ACTIVATION_MARKERS = ACTIVATE_MARKER + DEACTIVATE_MARKER;

const DOT_MARKER = "()";

export const POSITION_SPACE_RE = / /gu;

const PLAIN: Arrow = { line: SOLID, head: "open" };

export const arrowOf = (written: string): Arrow => ARROW_PATTERNS.get(written) ?? PLAIN;

// mermaid's `()` is a token of its own, so blanks between it and the actor's name belong to neither.
export function trailingDot(written: string): [string, boolean] {
  if (!written.endsWith(DOT_MARKER)) return [written, false];
  return [written.slice(0, -DOT_MARKER.length).trimEnd(), true];
}

export function leadingDot(written: string): [string, boolean] {
  if (!written.startsWith(DOT_MARKER)) return [written, false];
  return [written.slice(DOT_MARKER.length).trimStart(), true];
}

// The `+` and `-` are mermaid tokens of their own too, so blanks after them are not the actor's.
export function splitMarker(written: string): [string, string] {
  const first = written.slice(0, 1);
  if (first !== "" && ACTIVATION_MARKERS.includes(first)) return [written.slice(1).trimStart(), first];
  return [written, ""];
}

export const RECT = "rect";

// mermaid's `extractWrap` (`sequenceDb.ts`): a leading `wrap:` or `nowrap:`, with an optional colon in front, says
// how the label folds and is never drawn. Its own two regexes carry no `i` flag, so only the lower case counts.
const WRAP_RE = /^:?(no)?wrap:/u;

export function extractWrap(text: string): [text: string, wrap: boolean | undefined] {
  const found = WRAP_RE.exec(text.trim()) ?? undefined;
  if (found === undefined) return [text, undefined];
  return [text.trim().slice(found[0].length).trim(), found[1] === undefined];
}
