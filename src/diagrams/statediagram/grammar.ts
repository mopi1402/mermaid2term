import { NodeShape } from "../../graph/shapes.js";
import { WORD_CHAR } from "../../text/format.js";

export const START_ID = "[*]_start";
export const END_ID = "[*]_end";
export const HEADER = "stateDiagram";
export const HEADER_RE = /^stateDiagram(?:-v2(?=\s|$))?/u;
export const CLOSE_BRACE = "}";
export const OPEN_BRACE = "{";
export const REGION_CUT = "--";
export const START_MARK = "[*]";

export const ROOT_SCOPE = "root";

const WORD = WORD_CHAR;

export const NOTE_RE = new RegExp(String.raw`^note\s+(right\s+of|left\s+of)\s+(\S+)\s*(?::\s*(.*))?$`, "iu");
export const NOTE_POSITIONS = ["rightof", "leftof"] as const;
export type NotePosition = (typeof NOTE_POSITIONS)[number];
export const END_NOTE = "end note";
export const NOTE_ID = "note:";
export const NOTE_PREFIX = "note ";
// Both spellings mermaid's lexer carries, `<<fork>>` beside `[[fork]]`, and the keyword in any case its `i` flag takes.
const STEREOTYPE = String.raw`(?:<<${WORD}+>>|\[\[${WORD}+\]\])`;
export const ALIAS_RE = new RegExp(String.raw`^state\s+"([^"]+)"\s+as\s+(\S+)\s*(${STEREOTYPE})?\s*(\{)?`, "iu");
export const STEREOTYPE_RE = new RegExp(String.raw`^state\s+(\S+)\s+(${STEREOTYPE})`, "iu");
// The tail is what follows the brace on the SAME line: `state Empty { }` closes the scope it just opened.
export const COMPOSITE_RE = /^state\s+"?([^"{}]+)"?\s*\{(.*)$/iu;
export const TRANSITION_RE = /^(.+?)\s*-->\s*(.+?)(?:\s*(?<!:):(?!:)\s*(.+))?$/u;
// mermaid's ID token is any run but a blank, a colon or a dash (`a.b`, `x#y`, `1abc`); a brace is kept out of it
// here, a lone `{` being the brace of a composite whose name stands on the line above.
const STATE_ID = String.raw`(?!\[\*\])[^\s:\-"{}]+`;
export const PLAIN_STATE_RE = new RegExp(String.raw`^${STATE_ID}$`, "u");
export const DESCRIPTION_RE = new RegExp(String.raw`^(${STATE_ID})(?::::(${WORD}+))?\s*(?<!:):(?!:)\s*(.+)$`, "u");
export const CLASSDEF_PREFIX = "classdef ";
export const CLASS_PREFIX = "class ";
export const CLASS_RE = /^class\s+(.+?)\s+(\S+)$/iu;
export const STYLE_PREFIX = "style ";
export const CLICK_PREFIX = "click ";

export function stereotypeToShape(stereotype: string | undefined): NodeShape {
  if (stereotype === undefined || stereotype === "") return NodeShape.ROUNDED;
  const s = stereotype.toLowerCase();
  if (s.includes("choice")) return NodeShape.CHOICE_STATE;
  if (s.includes("fork") || s.includes("join")) return NodeShape.FORK_JOIN;
  return NodeShape.ROUNDED;
}

