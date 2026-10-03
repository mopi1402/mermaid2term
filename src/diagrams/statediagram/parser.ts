import {
  Direction,
  directionOf,
  Graph,
  makeEdge,
  EdgeStyle,
  wearClass,
  blendProps,
} from "../../graph/model.js";
import { NodeShape } from "../../graph/shapes.js";
import { Scopes } from "./scopes.js";
import { BR_RE, LITERAL_NEWLINE, boxLabel, lineLabel } from "../../text/labels.js";
import { readClassDef, splitStyleClass } from "../../source/css.js";
import { contentLines, headerBody } from "../../source/lines.js";
import { DIRECTION_ANYWHERE_RE } from "../@common/box-diagram.js";
import { readClick } from "../@common/click.js";
import { resolveClusterEdges } from "../../graph/clusters.js";
import { withoutAccessible } from "../@common/accessible.js";
import { applyRules, type LineRule } from "../@common/rules.js";
import { readStyle } from "../@common/styles.js";
import { everySubgraph } from "../../graph/subgraph-tree.js";
import { must, oneOf } from "../../must.js";

import {
  ALIAS_RE,
  CLASSDEF_PREFIX,
  CLASS_PREFIX,
  CLASS_RE,
  CLICK_PREFIX,
  CLOSE_BRACE,
  COMPOSITE_RE,
  DESCRIPTION_RE,
  END_ID,
  END_NOTE,
  HEADER,
  HEADER_RE,
  NOTE_ID,
  NOTE_POSITIONS,
  NOTE_PREFIX,
  NOTE_RE,
  OPEN_BRACE,
  PLAIN_STATE_RE,
  REGION_CUT,
  ROOT_SCOPE,
  START_ID,
  START_MARK,
  STEREOTYPE_RE,
  STYLE_PREFIX,
  TRANSITION_RE,
  stereotypeToShape,
  type NotePosition,
} from "./grammar.js";

const STATE_KEYWORD_RE = /^state\s/iu;
const REGION_CUT_RE = new RegExp(String.raw`^${REGION_CUT}$`, "u");
const CLOSE_BRACE_RE = /^\}$/u;
// `note ` in any case, as `toLowerCase` reads it: no character but its capitals lowers to one of its letters.
const NOTE_START_RE = new RegExp(`^${NOTE_PREFIX}`, "i");

// `state X` then `{` on the next line: mermaid's lexer skips the newline between them, so it is one statement.
function bracesFolded(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const last = out.length - 1;
    if (line.trim() === OPEN_BRACE && last >= 0 && STATE_KEYWORD_RE.test(out[last].trim()) && !out[last].includes(OPEN_BRACE)) {
      out[last] = `${out[last]} ${OPEN_BRACE}`;
    } else out.push(line);
  }
  return out;
}

export function parseStateDiagram(text: string): Graph {
  return new StateDiagramParser(text).parse();
}

class StateDiagramParser {
  private graph = new Graph();
  private aliases = new Map<string, string>();
  private readonly scopes = new Scopes(this.graph);
  private pendingNote: { position: NotePosition; target: string; lines: string[] } | undefined = undefined;
  private noteCount = 0;
  private worn: Array<[string, string]> = [];
  private clicks: string[] = [];

  constructor(private text: string) {}

  parse(): Graph {
    const lines = bracesFolded(contentLines(this.text));
    if (lines.length === 0) return this.graph;

    const header = lines[0].trim();
    if (header.toLowerCase().startsWith(HEADER.toLowerCase())) this.graph.direction = Direction.TB;
    // mermaid's `"stateDiagram"\s+` reads a statement written after the keyword on the same line.
    for (const line of withoutAccessible(headerBody(lines, HEADER_RE))) this.parseLine(line);
    resolveClusterEdges(this.graph);
    this.dressStates();
    // Linked once every state is known, as the classes are: mermaid's `click` finds a state the source names later.
    for (const line of this.clicks) readClick(this.graph, line);
    return this.graph;
  }

  // Dressed once every state is known: mermaid mints the state at `class`, so a transition written later finds it.
  // A composite takes its classes alone: mermaid's `roundedWithTitle` lays no inline style on its rects.
  private dressStates(): void {
    for (const [id, name] of this.worn) {
      const node = this.graph.nodes.get(id);
      if (node !== undefined) wearClass(node, name);
    }
    // mermaid's `colorSlotFor`: every composite takes the next slot, one the source styles keeps none, a region its own.
    let slot = 0;
    for (const sg of everySubgraph(this.graph)) {
      const classes = this.worn.filter(([id]) => id === sg.id).map(([, name]) => name);
      const props = blendProps(this.graph.classDefs, classes);
      if (props.size > 0) sg.props = props;
      if (sg.concurrent) sg.colorIndex = sg.parent?.colorIndex;
      else if (classes.length === 0 && !this.graph.nodeStyles.has(sg.id)) sg.colorIndex = slot++;
      else slot++;
    }
  }

  // The lines that open on a keyword, in any case, in the order they are tried.
  private readonly keywords: ReadonlyArray<readonly [string, (line: string) => void]> = [
    [CLASSDEF_PREFIX, (line) => { readClassDef(this.graph.classDefs, line); }],
    [
      CLASS_PREFIX,
      (line) => {
        const listed = CLASS_RE.exec(line.trim()) ?? undefined;
        if (listed !== undefined) for (const id of listed[1].split(/[,\s]+/u)) this.wearClass(id, listed[2]);
      },
    ],
    [STYLE_PREFIX, (line) => readStyle(this.graph, line.trim(), true)],
    [CLICK_PREFIX, (line) => { this.clicks.push(line.trim()); }],
  ];

  // The scope lines, read before the keywords.
  private readonly scoping: ReadonlyArray<LineRule<StateDiagramParser>> = [
    { pattern: DIRECTION_ANYWHERE_RE, apply: (parser, found) => parser.declareDirection(found[1]) },
    { pattern: REGION_CUT_RE, apply: (parser) => parser.scopes.cut() },
    { pattern: CLOSE_BRACE_RE, apply: (parser) => parser.scopes.close() },
  ];

  // The statements, read after the keywords, in the order they are tried.
  private readonly statements: ReadonlyArray<LineRule<StateDiagramParser>> = [
    {
      pattern: NOTE_RE,
      apply: (parser, note) => {
        const position = must(oneOf(NOTE_POSITIONS, note[1].toLowerCase().replaceAll(" ", "")));
        const target = note[2];
        if (note[3] === undefined) parser.pendingNote = { position, target, lines: [] };
        else parser.addNote(position, target, note[3].trim().replace(BR_RE, LITERAL_NEWLINE));
      },
    },
    // Any other note line mermaid would refuse is dropped.
    { pattern: NOTE_START_RE, apply: () => undefined },
    {
      pattern: ALIAS_RE,
      apply: (parser, alias, line) => {
        const label = boxLabel(alias[1]);
        const id = alias[2];
        parser.aliases.set(id, label);
        // `state "Named thing" as N { ... }`: mermaid names the cluster and reads the body into it.
        if (alias[4] !== undefined) parser.openComposite(id, label, line.slice(line.indexOf(OPEN_BRACE) + 1));
        else parser.scopes.ensureNode(id, label, stereotypeToShape(alias[3]));
      },
    },
    { pattern: STEREOTYPE_RE, apply: (parser, found) => parser.scopes.ensureNode(found[1], found[1], stereotypeToShape(found[2])) },
    {
      pattern: COMPOSITE_RE,
      apply: (parser, composite) => {
        const name = composite[1].trim();
        const id = name.replaceAll(" ", "_");
        parser.openComposite(id, parser.aliases.get(id) ?? name, composite[2]);
      },
    },
    {
      pattern: TRANSITION_RE,
      apply: (parser, transition) => {
        const source = parser.resolveState(transition[1].trim(), true);
        const target = parser.resolveState(transition[2].trim(), false);
        const label = lineLabel((transition[3] ?? "").trim());
        parser.graph.addEdge(makeEdge(source, target, { label, style: EdgeStyle.SOLID, hasArrowEnd: true }));
      },
    },
    {
      pattern: DESCRIPTION_RE,
      apply: (parser, described) => {
        const id = described[1];
        const label = boxLabel(described[3].trim());
        parser.aliases.set(id, label);
        const box = parser.graph.findSubgraphById(id);
        if (box !== undefined) box.label = label;
        else parser.scopes.ensureNode(id, label, NodeShape.ROUNDED);
        if (described[2] !== undefined) parser.wearClass(id, described[2]);
      },
    },
  ];

  // Every line the parser reads comes in trimmed.
  private parseLine(line: string): void {
    const lower = line.trim().toLowerCase();

    if (this.pendingNote !== undefined) {
      if (lower === END_NOTE) {
        const { position, target, lines } = this.pendingNote;
        this.pendingNote = undefined;
        this.addNote(position, target, lines.join(LITERAL_NEWLINE));
      } else this.pendingNote.lines.push(line);
      return;
    }

    if (applyRules(this.scoping, this, line)) return;
    const keyword = this.keywords.find(([prefix]) => lower.startsWith(prefix));
    if (keyword !== undefined) return keyword[1](line);
    if (applyRules(this.statements, this, line)) return;

    const [bare, bareClass] = splitStyleClass(line.trim());
    if (PLAIN_STATE_RE.test(bare)) {
      if (!this.graph.nodes.has(bare)) this.scopes.ensureNode(bare, bare, NodeShape.ROUNDED);
      if (bareClass !== undefined) this.wearClass(bare, bareClass);
    }
  }

  private declareDirection(written: string): void {
    const direction = directionOf(written);
    if (direction === undefined) return;
    const composite = this.scopes.innermost;
    if (composite !== undefined) {
      // Inside a composite the line is the COMPOSITE's, as mermaid reads it: `direction BT` under `state B {` turned
      // the whole diagram round and left B to inherit.
      composite.direction = direction;
      return;
    }
    this.graph.direction = direction;
    // An author's word, which the auto-orientation must not override the way it overrides the header's default.
    this.graph.directionDeclared = true;
  }

  // A composite opens a scope, and closes it again when its own line carries the `}`: `state Empty { }` is a box,
  // never a scope left open over everything that follows.
  private openComposite(id: string, label: string, tail: string): void {
    this.scopes.open(id, label);
    const at = tail.lastIndexOf(CLOSE_BRACE);
    if (at === -1) return;
    const inside = tail.slice(0, at).trim();
    if (inside !== "") this.parseLine(inside);
    this.scopes.close();
  }

  private wearClass(id: string, styleClass: string): void {
    if (id !== "") this.worn.push([id, styleClass]);
  }

  private resolveState(rawWithClass: string, isSource: boolean): string {
    const [raw, styleClass] = splitStyleClass(rawWithClass);
    if (styleClass !== undefined) {
      const id = this.resolveState(raw, isSource);
      this.wearClass(id, styleClass);
      return id;
    }
    if (raw === START_MARK) {
      const scope = this.scopes.innermost?.id ?? ROOT_SCOPE;
      const id = `${isSource ? START_ID : END_ID}_${scope}`;
      if (!this.graph.nodes.has(id)) this.scopes.ensureNode(id, "", isSource ? NodeShape.START_STATE : NodeShape.END_STATE);
      return id;
    }

    if (!this.graph.nodes.has(raw)) {
      this.scopes.ensureNode(raw, this.aliases.get(raw) ?? raw, NodeShape.ROUNDED);
    }
    return raw;
  }

  private addNote(position: NotePosition, target: string, text: string): void {
    if (!this.graph.nodes.has(target)) this.scopes.ensureNode(target, this.aliases.get(target) ?? target, NodeShape.ROUNDED);
    const id = `${NOTE_ID}${this.noteCount++}`;
    this.scopes.ensureNode(id, text, NodeShape.NOTE);
    const [source, sink] = position === "leftof" ? [id, target] : [target, id];
    this.graph.addEdge(makeEdge(source, sink, { style: EdgeStyle.DOTTED, hasArrowEnd: false }));
  }

}
