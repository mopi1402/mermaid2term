import {
  CLASSIFIERS,
  DASHED,
  LOLLIPOP,
  makeClassDef,
  makeClassDiagram,
  MARKERS,
  SOLID,
  VISIBILITIES,
  type ClassDef,
  type ClassDiagram,
  type Member,
  type Namespace,
} from "./model.js";
import { boxLabel, lineLabel } from "../../text/labels.js";
import { htmlDecoded } from "../../text/entities.js";
import { relationLabel } from "../../source/markdown.js";
import { terminalUrl } from "../../text/width.js";
import { CLASSDEF_RE, defineClasses, parseCssProps } from "../../source/css.js";
import { CLOSING_BRACE, DIRECTION_ANYWHERE_CASED_RE, DIRECTION_RE, braceBody } from "../@common/box-diagram.js";
import { COMMENT, FRONTMATTER_FENCE, uncommented } from "../../source/lines.js";
import { ensured, must, oneOf } from "../../must.js";
import { NEWLINE } from "../../text/chars.js";
import { directionOf } from "../../graph/model.js";
import { generics } from "../@common/generics.js";
import { withoutAccessible } from "../@common/accessible.js";
import { applyRules, type LineRule } from "../@common/rules.js";
import { ANNOTATION_LINE_RE, ANNOTATION_RE, CLASS_BRACE_RE, CLASS_INLINE_BODY_RE, CLASS_SIMPLE_RE, COLON_MEMBER_RE, CSSCLASS_RE, CSS_MARK_RE, FIRST_WORD_RE, HEADER, LINK_RE, LOWERCASE_TYPES, NAMESPACE_INLINE_RE, NAMESPACE_RE, NOTE_FOR_RE, NOTE_RE, REL_RE, SKIP_RE, STYLE_RE, classLabel, isUpper, stripBrackets, unquoted } from "./patterns.js";

function openNamespace(root: Namespace[], dotted: string, label: string | undefined, prefix: string): Namespace {
  let siblings = root;
  let found: Namespace | undefined;
  let id = prefix;
  for (const segment of dotted.split(".")) {
    id = id === "" ? segment : `${id}.${segment}`;
    found = siblings.find((ns) => ns.id === id) ?? undefined;
    if (found === undefined) {
      found = { id, label: segment, explicit: false, classes: [], children: [] };
      siblings.push(found);
    }
    siblings = found.children;
  }
  const leaf = must(found);
  leaf.explicit = true;
  if (label !== undefined) leaf.label = label;
  return leaf;
}

function parseMemberText(written: string): Member {
  let text = written.trim();
  const visibility = text === "" ? undefined : oneOf(VISIBILITIES, text[0]);
  if (visibility !== undefined) text = text.slice(1);
  text = generics(text);
  let classifier = text === "" ? undefined : oneOf(CLASSIFIERS, text[text.length - 1]);
  if (classifier !== undefined) text = text.slice(0, -1);
  text = text.trim();

  const isMethod = text.includes("(") && text.includes(")");
  let returnType = "";

  if (isMethod) {
    const end = text.lastIndexOf(")");
    // mermaid's `\)([\s$*])?(.*)`: a sign glued to the parenthesis is the classifier, the words after it the type.
    const glued = classifier === undefined ? oneOf(CLASSIFIERS, text[end + 1]) : undefined;
    if (glued !== undefined) {
      classifier = glued;
      text = text.slice(0, end + 1) + text.slice(end + 2);
    }
    const after = text.slice(end + 1).trim();
    if (after !== "") {
      returnType = after;
      text = text.slice(0, end + 1);
    }
  } else {
    const split = FIRST_WORD_RE.exec(text) ?? undefined;
    if (split !== undefined) {
      const first = split[1];
      if (isUpper(first[0]) || LOWERCASE_TYPES.has(first)) {
        returnType = first;
        text = split[2];
      }
    }
  }

  return { name: htmlDecoded(text.trim()), visibility, returnType: htmlDecoded(returnType), isMethod, classifier };
}

// A body written between braces on ONE row is the same statement written over three, which is how mermaid's lexer
// reads it: `{` opens the struct, `}` closes it wherever it stands. Opening the row out here spares every reader
// below a second shape to know. Its whole inner text is one member, as mermaid's `/^(?:[^{}\n]*)/` rule gives it.
function openedOut(line: string): string[] {
  const inline = CLASS_INLINE_BODY_RE.exec(line) ?? NAMESPACE_INLINE_RE.exec(line) ?? undefined;
  if (inline === undefined) return [line];
  const inner = must(inline[inline.length - 1]).trim();
  const head = line.slice(0, line.indexOf("{") + 1);
  return inner === "" ? [head, CLOSING_BRACE] : [head, inner, CLOSING_BRACE];
}

const ensureClass = (diagram: ClassDiagram, name: string): ClassDef => ensured(diagram.classes, name, makeClassDef);

// What the lines read so far have opened, and where the next one stands (a class body moves it past its `}`).
interface Reading {
  readonly diagram: ClassDiagram;
  readonly lines: readonly string[];
  next: number;
  readonly open: Namespace[];
  // The `:::class` the line being read is marked with, taken off it before the declarations read it.
  cssClass: string | undefined;
}

function enrol({ open }: Reading, name: string): void {
  const inner = open[open.length - 1];
  if (inner !== undefined && !inner.classes.includes(name)) inner.classes.push(name);
}

function declare(reading: Reading, head: RegExpExecArray): ClassDef {
  const { diagram, cssClass } = reading;
  const name = unquoted(head[1]);
  const cls = ensureClass(diagram, name);
  enrol(reading, name);
  if (cssClass !== undefined) cls.cssClasses.push(cssClass);
  cls.label = classLabel(name, head[2], head[3]);
  if (head[4] !== undefined) cls.annotation = stripBrackets(head[4]);
  return cls;
}

function declareDirection({ diagram }: Reading, found: RegExpExecArray): void {
  diagram.direction = must(directionOf(found[1], true));
  diagram.directionDeclared = true;
}

function declareBraced(reading: Reading, found: RegExpExecArray): void {
  const cls = declare(reading, found);
  const block = braceBody(reading.lines, reading.next);
  reading.next = block.next;
  for (const body of block.rows) {
    const inner = ANNOTATION_RE.exec(body) ?? undefined;
    if (inner === undefined) cls.members.push(parseMemberText(body));
    else cls.annotation = inner[1];
  }
}

function relate({ diagram }: Reading, relationship: RegExpExecArray): void {
  const lollipopId = (name: string): string => {
    const id = `${name}${LOLLIPOP}${diagram.relationships.length}`;
    const cls = ensureClass(diagram, id);
    cls.label = name;
    cls.lollipop = true;
    return id;
  };
  const sourceName = unquoted(relationship[1]);
  const targetName = unquoted(relationship[8]);
  const source = relationship[4] === LOLLIPOP ? lollipopId(sourceName) : sourceName;
  const target = relationship[6] === LOLLIPOP ? lollipopId(targetName) : targetName;
  ensureClass(diagram, source);
  ensureClass(diagram, target);
  for (const [name, generic] of [[source, relationship[2]], [target, relationship[9]]] as const) {
    const cls = must(diagram.classes.get(name));
    if (generic !== undefined && cls.label === name) cls.label = classLabel(name, generic, undefined);
  }
  diagram.relationships.push({
    source,
    target,
    sourceMarker: oneOf(MARKERS, relationship[4]),
    targetMarker: oneOf(MARKERS, relationship[6]),
    lineStyle: relationship[5].includes("..") ? DASHED : SOLID,
    ...relationLabel(lineLabel((relationship[10] ?? "").trim())),
    sourceCard: relationship[3] ?? "",
    targetCard: relationship[7] ?? "",
  });
}

const CLOSING_BRACE_RE = /^\}$/u;

// The statements read before a line's `:::class` comes off, in the order they are tried.
const STATEMENTS: ReadonlyArray<LineRule<Reading>> = [
  { pattern: DIRECTION_RE, apply: declareDirection },
  { pattern: DIRECTION_ANYWHERE_CASED_RE, apply: declareDirection },
  {
    pattern: LINK_RE,
    apply: ({ diagram }, found) => {
      const cls = diagram.classes.get(unquoted((found[1] ?? found[2])));
      const url = terminalUrl(found[3]);
      if (cls !== undefined && url !== undefined) cls.link = url;
    },
  },
  {
    pattern: STYLE_RE,
    apply: ({ diagram }, found) => {
      const cls = diagram.classes.get(unquoted(found[1]));
      if (cls !== undefined) for (const [prop, value] of parseCssProps(found[2])) cls.styles.set(prop, value);
    },
  },
  { pattern: CLASSDEF_RE, apply: ({ diagram }, found) => defineClasses(diagram.classDefs, found[1], parseCssProps(found[2])) },
  {
    pattern: CSSCLASS_RE,
    apply: ({ diagram }, found) => {
      for (const id of found[1].split(",")) diagram.classes.get(id.trim())?.cssClasses.push(found[2]);
    },
  },
  {
    pattern: SKIP_RE,
    apply: ({ diagram }, _found, line) => diagram.warnings.push(`Unsupported directive (ignored): ${JSON.stringify(line)}`),
  },
  { pattern: CLOSING_BRACE_RE, apply: ({ open }) => open.pop() },
  {
    pattern: NAMESPACE_RE,
    apply: ({ diagram, open }, found) => {
      const parent = open[open.length - 1];
      open.push(
        openNamespace(parent === undefined ? diagram.namespaces : parent.children, unquoted(found[1]), found[2], parent?.id ?? "")
      );
    },
  },
  {
    pattern: NOTE_FOR_RE,
    apply: ({ diagram }, found) => diagram.notes.push({ text: boxLabel(found[2]), target: unquoted(found[1]) }),
  },
  { pattern: NOTE_RE, apply: ({ diagram }, found) => diagram.notes.push({ text: boxLabel(found[1]), target: "" }) },
  {
    pattern: ANNOTATION_LINE_RE,
    apply: ({ diagram }, found) => {
      ensureClass(diagram, unquoted(found[2])).annotation = found[1];
    },
  },
];

// The declarations, read on the line with its `:::class` taken off.
const DECLARATIONS: ReadonlyArray<LineRule<Reading>> = [
  { pattern: CLASS_BRACE_RE, apply: declareBraced },
  { pattern: CLASS_SIMPLE_RE, apply: (reading, found) => { declare(reading, found); } },
  { pattern: REL_RE, apply: relate },
  {
    pattern: COLON_MEMBER_RE,
    apply: ({ diagram }, found) => {
      ensureClass(diagram, unquoted(found[1])).members.push(parseMemberText(found[2]));
    },
  },
];

export function parseClassDiagram(text: string): ClassDiagram {
  const diagram = makeClassDiagram();
  const written = text.split(NEWLINE).map(uncommented);
  const lines = withoutAccessible(written).flatMap(openedOut);
  const reading: Reading = { diagram, lines, next: 0, open: [], cssClass: undefined };

  while (reading.next < lines.length) {
    const stripped = lines[reading.next].trim();
    reading.next += 1;

    if (
      stripped === "" ||
      stripped.startsWith(HEADER) ||
      stripped.startsWith(COMMENT) ||
      stripped === FRONTMATTER_FENCE
    ) {
      continue;
    }
    if (applyRules(STATEMENTS, reading, stripped)) continue;

    const marked = CSS_MARK_RE.exec(stripped) ?? undefined;
    reading.cssClass = marked === undefined ? undefined : (marked[2]);
    const bare = marked === undefined ? stripped : (marked[1]) + (marked[3]);
    if (applyRules(DECLARATIONS, reading, bare)) continue;

    diagram.warnings.push(`Unrecognized line: ${JSON.stringify(bare)}`);
  }

  return diagram;
}
