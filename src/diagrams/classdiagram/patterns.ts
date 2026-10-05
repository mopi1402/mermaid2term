import { boxLabel } from "../../text/labels.js";
import { WORD_CHAR, stripChars } from "../../text/format.js";
import { generics } from "../@common/generics.js";
import { BACKTICKED } from "../../source/quotes.js";

const W = WORD_CHAR;

// mermaid's `className` is a run of its `\w+`, `-` and `.` tokens glued together, so a dotted or dashed name is
// one id and not a dropped line: `/^(?:-)/` and `/^(?:\.)/` sit in its lexer beside the word rule.
const ID = String.raw`((?:${W}|[.-])+|${BACKTICKED})`;

export { unBackticked as unquoted } from "../../source/quotes.js";

const LABEL = String.raw`(?:\["([^"]*)"\])?`;

const GENERIC = String.raw`(?:\s*~([^~]+)~)?`;

export const CLASS_BRACE_RE = new RegExp(String.raw`^\s*class\s+${ID}${GENERIC}${LABEL}(?:\s*(<<${W}+>>))?\s*\{\s*$`, "u");

// `class A { +x }` and `class A {}` on one line: mermaid's `}` rule closes the struct wherever it stands, so the
// members between the braces are read and the body is over on the same row.
export const CLASS_INLINE_BODY_RE = new RegExp(
  String.raw`^\s*class\s+${ID}${GENERIC}${LABEL}(?:\s*(<<${W}+>>))?\s*\{(.*)\}\s*$`,
  "u"
);

export const CLASS_SIMPLE_RE = new RegExp(String.raw`^\s*class\s+${ID}${GENERIC}${LABEL}(?:\s*(<<${W}+>>))?\s*$`, "u");

export const ANNOTATION_RE = new RegExp(String.raw`^\s*<<(${W}+)>>\s*$`, "u");

export const ANNOTATION_LINE_RE = new RegExp(String.raw`^\s*<<(${W}+)>>\s+${ID}${GENERIC}\s*$`, "u");

export const COLON_MEMBER_RE = new RegExp(String.raw`^\s*${ID}\s*:\s*(.+?)\s*$`, "u");

// Every head rule in mermaid's lexer opens on `\s*` (`/^(?:\s*<\|)/`, `/^(?:\s*\*)/`, ...), so a space between a
// head and its line is whitespace like any other and `C <| -- D` is the relation it looks like.
export const REL_RE = new RegExp(
  String.raw`^\s*${ID}${GENERIC}\s*(?:"([^"]*)")?\s*((?:<\||\(\)|[<*o])?)\s*(--|\.\.)\s*((?:\|>|\(\)|[>*o])?)\s*(?:"([^"]*)")?\s*${ID}${GENERIC}(?:\s*:\s*(.+?))?\s*$`,
  "u"
);

export const NOTE_FOR_RE = new RegExp(String.raw`^\s*note\s+for\s+${ID}\s+"([^"]*)"\s*$`, "iu");

export const NOTE_RE = /^\s*note\s+"([^"]*)"\s*$/iu;

// mermaid's `namespaceName` takes a backticked run too, spaces and all.
const NAMESPACE_NAME = String.raw`(${BACKTICKED}|\S+?)`;

export const NAMESPACE_RE = new RegExp(String.raw`^\s*namespace\s+${NAMESPACE_NAME}${LABEL}\s*\{\s*$`, "iu");

// `namespace One { class X }` on one line, which mermaid reads as an open, its statements and a close.
export const NAMESPACE_INLINE_RE = new RegExp(String.raw`^\s*namespace\s+${NAMESPACE_NAME}${LABEL}\s*\{(.*)\}\s*$`, "iu");

export const SKIP_RE = /^\s*(?:style\s|classDef\s|cssClass\s|click\s|callback\s|link\s)/iu;

export const LINK_RE = new RegExp(String.raw`^\s*(?:link\s+${ID}|click\s+${ID}\s+href)\s+"([^"]*)"`, "iu");

export const STYLE_RE = new RegExp(String.raw`^\s*style\s+${ID}\s+(.+?)\s*$`, "iu");

export const CSSCLASS_RE = new RegExp(String.raw`^\s*cssClass\s+"([^"]*)"\s+(${W}+)\s*$`, "iu");

export const CSS_MARK_RE = new RegExp(String.raw`^(\s*class\s+.+?):::(${W}+)(\s*\{?\s*)$`, "iu");

export const LOWERCASE_TYPES = new Set(["int", "bool", "str", "float", "void", "string"]);

const ANNOTATION_BRACKETS = "<>";

export const HEADER = "classDiagram";


export const FIRST_WORD_RE = /^(\S+)\s+([\s\S]*)$/u;

export const stripBrackets = (text: string): string => stripChars(text, ANNOTATION_BRACKETS);

export const isUpper = (ch: string): boolean => ch.toLowerCase() !== ch.toUpperCase() && ch === ch.toUpperCase();

export const classLabel = (name: string, generic: string | undefined, label: string | undefined): string => {
  if (label !== undefined) return boxLabel(label);
  return generic === undefined ? name : `${name}<${generics(generic)}>`;
};
