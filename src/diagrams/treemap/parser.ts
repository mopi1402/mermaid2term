import { makeTreemap, makeTreemapNode, type Treemap, type TreemapNode } from "./model.js";
import { headerStatement, keptLines } from "../../source/lines.js";
import { type Declared, flagOf } from "../../source/config.js";
import { SPACE } from "../../text/chars.js";
import { readClassDef } from "../../source/css.js";
import { LANGIUM_QUOTES, titleOf } from "../@common/langium.js";
import { withoutAccessible } from "../@common/accessible.js";
import { nestByIndent } from "../@common/nest.js";

// mermaid's `treemap.langium`: `STRING2` quoted either way with no escape, `:` or `,` before a `NUMBER2` of digits,
// dots, underscores and commas, then an optional `:::class`.
const NODE_RE = /^(\s*)(?:"([^"]*)"|'([^']*)')(?:\s*[:,]\s*([0-9_.,]+))?(?::::([A-Za-z_]\w*))?/u;
const HEADER_RE = /^\s*(treemap(?:-beta)?)/u;
const SHOW_VALUES_KEY = "showValues";
const VALUE_FORMAT_KEY = "valueFormat";
// `CLASS_DEF`: the style text runs to the first `;`.
const CLASS_DEF_RE = /^\s*classDef\s+([A-Za-z_]\w+)\s+([^;]*)/u;
const THOUSANDS_RE = /,/gu;

// mermaid's value converter drops every comma, then `parseFloat` stops where the number does.
const valueOf = (written: string | undefined): number => {
  const value = written === undefined ? 0 : Number.parseFloat(written.replace(THOUSANDS_RE, ""));
  return Number.isNaN(value) ? 0 : value;
};

export function parseTreemap(text: string, said: Declared = {}): Treemap {
  const lines = keptLines(text, LANGIUM_QUOTES);
  const treemap = makeTreemap();
  treemap.showValues = flagOf(said, SHOW_VALUES_KEY) ?? treemap.showValues;
  const format = said[VALUE_FORMAT_KEY];
  if (format !== undefined && format !== "") treemap.valueFormat = format;
  if (lines.length === 0) return treemap;

  // A title or an item may follow the keyword on its line, the blanks after the keyword its indentation.
  const keyword = HEADER_RE.exec(lines[0])?.[1] ?? "";
  const header = headerStatement(lines[0], keyword).map(([indent, written]) => SPACE.repeat(indent) + written);

  const body: Array<readonly [number, TreemapNode]> = [];
  for (const line of withoutAccessible([...header, ...lines.slice(1)])) {
    const title = titleOf(line.trim());
    if (title !== undefined) {
      treemap.title = title;
      continue;
    }
    if (readClassDef(treemap.classDefs, line, CLASS_DEF_RE, true)) continue;
    const node = NODE_RE.exec(line) ?? undefined;
    if (node === undefined) continue;
    body.push([node[1].length, makeTreemapNode(node[2] ?? node[3] ?? "", valueOf(node[4]), node[5])]);
  }

  const parentOf = nestByIndent<TreemapNode>();
  for (const [indent, node] of body) {
    const parent = parentOf(indent, node);
    if (parent === undefined) treemap.roots.push(node);
    else parent.children.push(node);
  }

  return treemap;
}
