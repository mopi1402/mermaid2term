import { type Graph, blendProps, wearClass } from "../../graph/model.js";
import { everySubgraph } from "../../graph/subgraph-tree.js";
import { firstWords, words } from "../../source/lines.js";
import { PROP_MARKER_END, PROP_MARKER_START, defineClasses, parseCssProps, saysNone } from "../../source/css.js";

const INTERPOLATE_RE = /^interpolate\s+\S+\s*/iu;

const DEFAULT_LINK_STYLE = -1;

export function readClassDef(graph: Graph, line: string): void {
  const parts = firstWords(line, 2);
  if (parts.length < 3) return;
  defineClasses(graph.classDefs, parts[1], parseCssProps(parts[2], true));
}

export function readLinkStyle(graph: Graph, line: string): void {
  const parts = firstWords(line, 2);
  if (parts.length < 3) return;
  const indices = parts[1];
  // `interpolate basis` names an SVG curve; the styles that may follow it still apply.
  const styles = parts[2].replace(INTERPOLATE_RE, "");
  if (styles === "") return;
  const props = parseCssProps(styles);
  if (indices.toLowerCase() === "default") {
    graph.linkStyles.set(DEFAULT_LINK_STYLE, props);
    return;
  }
  for (const raw of indices.split(",")) {
    const index = raw.trim();
    if (/^\d+$/.test(index)) graph.linkStyles.set(Number.parseInt(index, 10), props);
  }
}

export function readClassAssignment(graph: Graph, line: string, pendingLinks: Array<readonly [string, string]>): void {
  const parts = words(line);
  if (parts.length < 3) return;
  const className = parts[2];
  for (const raw of parts[1].split(",")) {
    const id = raw.trim();
    if (id === "") continue;
    const node = graph.nodes.get(id);
    if (node !== undefined) wearClass(node, className);
    else pendingLinks.push([id, className] as const);
  }
}

export function dressLinks(graph: Graph, pendingLinks: ReadonlyArray<readonly [string, string]>, edgeIndexById: ReadonlyMap<string, number>): void {
  for (const [id, className] of pendingLinks) {
    const index = edgeIndexById.get(id);
    const props = graph.classDefs.get(className);
    if (index === undefined || props === undefined) continue;
    if (!graph.linkStyles.has(index)) graph.linkStyles.set(index, props);
  }
}

// mermaid copies a link's styles into its path's inline `style`, where `marker-end: none` outranks the marker the
// arrow drew: the link is drawn without that head. Its own styles stand over `linkStyle default`, as they do for ink.
export function dropMarkers(graph: Graph): void {
  graph.edges.forEach((edge, index) => {
    const props = graph.linkStyles.get(index) ?? graph.linkStyles.get(DEFAULT_LINK_STYLE);
    if (saysNone(props, PROP_MARKER_END)) edge.hasArrowEnd = false;
    if (saysNone(props, PROP_MARKER_START)) edge.hasArrowStart = false;
  });
}

// mermaid's `setClass` reaches a subgraph of that id as well as a vertex or a link, and its `style` line reaches it
// through the vertex of the same id.
export function dressSubgraphs(graph: Graph, pendingLinks: ReadonlyArray<readonly [string, string]>): void {
  for (const sg of everySubgraph(graph)) {
    const classes = pendingLinks.filter(([id]) => id === sg.id).map(([, name]) => name);
    const props = new Map([...blendProps(graph.classDefs, classes), ...(graph.nodeStyles.get(sg.id) ?? [])]);
    if (props.size > 0) sg.props = props;
  }
}
