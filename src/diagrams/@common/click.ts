import type { Graph } from "../../graph/model.js";
import { terminalUrl } from "../../text/width.js";

const CLICK_KEYWORD = "click";
const HREF_KEYWORD = "href";
const URL_RE = /^"([^"]*)"/u;

/**
 * `click A "url" "tooltip"` and `click A href "url"`, the two spellings mermaid's flowchart and state grammars share.
 * The tooltip is read and dropped: a terminal has nothing to hover. An id naming no node is ignored.
 */
export function readClick(graph: Graph, line: string): void {
  const rest = line.slice(CLICK_KEYWORD.length).trim();
  const cut = rest.search(/\s/u);
  if (cut < 0) return;
  let tail = rest.slice(cut).trim();
  if (tail.toLowerCase().startsWith(HREF_KEYWORD)) tail = tail.slice(HREF_KEYWORD.length).trim();
  const quoted = URL_RE.exec(tail) ?? undefined;
  if (quoted === undefined) return;
  const url = terminalUrl(quoted[1]);
  if (url === undefined) return;
  for (const raw of rest.slice(0, cut).split(",")) {
    const node = graph.nodes.get(raw.trim());
    if (node !== undefined) node.link = url;
  }
}
