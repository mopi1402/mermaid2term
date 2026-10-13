import { makeKanban, makeKanbanColumn, type Kanban, type KanbanCard, type KanbanColumn } from "./model.js";
import { headerStatement, indentedStatements, keptLines } from "../../source/lines.js";
import { BLOCK_OPEN, blockEnd, opensBlock, parseAtShapeProps } from "../../source/shape-data.js";
import { colourToHex } from "../../colour/colours.js";
import { nodeLexer, type Lexed } from "../@common/mindmap-lexer.js";
import { openedIn } from "../@common/sections.js";
import { unfenced } from "../../source/quotes.js";

const KEYWORD = "kanban";  // keyword: mermaid's own word here, not a style key

// A decoration after a node, which mermaid 12 throws on: dropped, the node kept.
const DECORATION_RE = /^(?::::\S*|::icon\([^)]*\))$/iu;
const DECORATION_LINE_RE = /^(?::::|::icon\()/iu;

const LABEL_KEY = "label";  // keyword: mermaid's own metadata key here, not a style key
const TICKET_KEY = "ticket";  // keyword: mermaid's own metadata key here, not a style key
const ASSIGNED_KEY = "assigned";  // keyword: mermaid's own metadata key here, not a style key
const PRIORITY_KEY = "priority";  // keyword: mermaid's own metadata key here, not a style key

// `colorFromPriority` in mermaid's `kanbanItem`: `Medium` and every other word stroke nothing.
const PRIORITY_INKS: ReadonlyMap<string, string> = new Map([
  ["Very High", "red"],
  ["High", "orange"],
  ["Low", "blue"],
  ["Very Low", "lightblue"],
]);

interface KanbanNode {
  readonly label: string;
  readonly props: ReadonlyMap<string, string>;
}

const raw = (written: string): KanbanNode => ({ label: written.trim(), props: new Map() });

const endsNode = (rest: string): boolean => {
  const tail = rest.trimStart();
  return tail === "" || tail.startsWith(BLOCK_OPEN) || DECORATION_RE.test(tail);
};

const lexer = nodeLexer(KEYWORD, "@", endsNode);

export const kanbanWithIds = lexer.withIds;

const tokenLabel = (token: Lexed | undefined): readonly [string, string] | undefined =>
  token === undefined || unfenced(token.written).trim() === "" ? undefined : [unfenced(token.written), token.rest];

// The node's label and what follows it: mermaid's tokens, else the longest shape mermaid throws on that ends the node,
// else the tokens with the words mermaid throws on after them.
function labelled(written: string): readonly [string, string] | undefined {
  const id = lexer.idOf(written);
  if (!lexer.shapes(written.slice(id.length))) return [id, written.slice(id.length)];
  const token = lexer.tokens(written);
  if (token !== undefined) return tokenLabel(token);
  for (let at = written.length; at > id.length; at--) {
    if (!endsNode(written.slice(at))) continue;
    const shape = lexer.wrapped(written.slice(0, at).trimEnd());
    if (shape !== undefined) return [shape[0], written.slice(at)];
  }
  return tokenLabel(lexer.tokens(written, () => true));
}

function readNode(written: string): KanbanNode {
  const node = labelled(written);
  if (node === undefined) return raw(written);
  let [label, rest] = node;
  rest = rest.trimStart();
  let props: ReadonlyMap<string, string> = new Map();
  if (rest.startsWith(BLOCK_OPEN)) {
    const end = blockEnd(rest, BLOCK_OPEN.length);
    if (end === -1) return raw(written);
    props = parseAtShapeProps(rest.slice(BLOCK_OPEN.length, end));
    rest = rest.slice(end + 1).trim();
  }
  const named = props.get(LABEL_KEY) ?? "";
  const title = named !== "" ? named : label.trim();
  // Words mermaid throws on after a node stay behind its title, where a decoration goes.
  return { label: rest === "" || DECORATION_RE.test(rest) ? title : `${title} ${rest}`, props };
}

const opens = (text: string): boolean => lexer.opensString(text) || opensBlock(text);

function cardOf(node: KanbanNode): KanbanCard {
  const said = node.props.get(PRIORITY_KEY);
  const ink = said === undefined ? undefined : PRIORITY_INKS.get(said);
  return {
    title: node.label,
    ticket: node.props.get(TICKET_KEY) ?? "",
    assigned: node.props.get(ASSIGNED_KEY) ?? "",
    priority: ink === undefined ? undefined : colourToHex(ink),
  };
}

export function parseKanban(text: string): Kanban {
  const lines = keptLines(text);
  const board = makeKanban();
  if (lines.length === 0) return board;

  // mermaid stores a decoration on the node before it and never draws it.
  const body = [...headerStatement(lines[0], KEYWORD), ...indentedStatements(lines.slice(1), opens)].filter(
    ([, written]) => !DECORATION_LINE_RE.test(written)
  );
  if (body.length === 0) return board;

  const columnIndent = Math.min(...body.map(([indent]) => indent));
  let column: KanbanColumn | undefined;

  for (const [indent, written] of body) {
    const node = readNode(written);
    if (indent <= columnIndent) {
      column = makeKanbanColumn(node.label);
      board.columns.push(column);
      continue;
    }

    column = openedIn(board.columns, column, () => makeKanbanColumn(""));
    column.cards.push(cardOf(node));
  }

  return board;
}
