import { makeMindmap, makeMindmapNode, type Mindmap, type MindmapNode } from "./model.js";
import { headerStatement, indentedStatements, keptLines } from "../../source/lines.js";
import { numberOf } from "../../text/format.js";
import { type Declared } from "../../source/config.js";
import { cellsFor } from "../../text/wrap.js";
import { markdownWrapOf } from "../../graph/layout/boxes.js";
import { nodeLexer } from "../@common/mindmap-lexer.js";
import { unfenced } from "../../source/quotes.js";
import { nestByIndent } from "../@common/nest.js";

const ICON_RE = /^::icon\(([^)]*)\)/u;
const CLASS_MARK = ":::";

const KEYWORD = "mindmap";  // keyword: mermaid's own word here, not a style key

const lexer = nodeLexer(KEYWORD, "", (rest) => rest.trim() === "");

export const mindmapWithIds = lexer.withIds;

function nodeOf(written: string): MindmapNode {
  const token = lexer.tokens(written);
  if (token !== undefined) return makeMindmapNode(unfenced(token.written), [], token.element);
  const shape = lexer.wrapped(written);
  return shape === undefined ? makeMindmapNode(written) : makeMindmapNode(shape[0], [], shape[1]);
}

const NODE_WIDTH_KEY = "maxNodeWidth";

export function parseMindmap(text: string, said: Declared = {}): Mindmap {
  const lines = keptLines(text);
  const mindmap = makeMindmap();
  const px = numberOf(said[NODE_WIDTH_KEY] ?? "");
  if (px !== undefined && px > 0) mindmap.wrap = cellsFor(px);
  // Every mindmap node is markdown in mermaid 12, so the key lays each one on a line.
  mindmap.wrap = markdownWrapOf(said, mindmap.wrap);
  const parentOf = nestByIndent<MindmapNode>();
  let last: MindmapNode | undefined;

  const body = lines.length === 0 ? [] : [...headerStatement(lines[0], KEYWORD), ...indentedStatements(lines.slice(1), lexer.opensString)];
  for (const [indent, written] of body) {
    const icon = ICON_RE.exec(written) ?? undefined;
    if (icon !== undefined || written.startsWith(CLASS_MARK)) {
      // mermaid decorates the last node read; before any node it has none, and the line is dropped here.
      if (last === undefined) continue;
      if (icon !== undefined) last.icon = icon[1].trim();
      else last.classes = written.slice(CLASS_MARK.length).trim();
      continue;
    }

    const node = nodeOf(written);
    const parent = parentOf(indent, node);
    if (parent !== undefined) parent.children.push(node);
    else if (mindmap.root === undefined) mindmap.root = node;
    else mindmap.root.children.push(node);
    last = node;
  }

  return mindmap;
}
