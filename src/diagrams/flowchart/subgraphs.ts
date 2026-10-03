import { Graph, directionOf, makeNode, makeSubgraph, type Subgraph } from "../../graph/model.js";
import { NodeShape } from "../../graph/shapes.js";
import { words } from "../../source/lines.js";
import { stripQuotes } from "../../source/quotes.js";
import { boxLabel, unIconed } from "../../text/labels.js";
import { parseMarkdownLabel, taggedSegments } from "../../source/markdown.js";
import { everySubgraph } from "../../graph/clusters.js";
import { parseAtShapeProps } from "../../source/shape-data.js";
import { AT_SHAPE_RE } from "./shapes.js";

const SUBGRAPH_KEYWORD = "subgraph";  // keyword: mermaid's own word here, not a style key
const SUBGRAPH_BRACKET_RE = /^([^\s["]+)\s*\[(.+)\]$/u;
const LABEL_KEY = "label";  // keyword: mermaid's own metadata key here, not a style key

export function openSubgraph(graph: Graph, stack: Subgraph[], line: string): void {
  const rest = line.slice(SUBGRAPH_KEYWORD.length).trim();
  let id = rest;
  let label = rest;
  const bracket = SUBGRAPH_BRACKET_RE.exec(rest) ?? undefined;
  // mermaid 12 lets a container carry `@{ … }`: its `algorithm` picks an ELK layout, meaningless here; a `label`
  // titles it.
  const meta = AT_SHAPE_RE.exec(rest) ?? undefined;
  if (meta !== undefined) {
    id = meta[1];
    label = parseAtShapeProps(meta[2]).get(LABEL_KEY) ?? id;
  } else if (bracket !== undefined) {
    id = bracket[1];
    label = bracket[2];
  } else if (rest.includes(" ")) {
    id = words(rest)[0];
    label = rest;
  }

  const parent = stack[stack.length - 1] ?? undefined;
  // A subgraph's slot is its place in the order the subgraphs open, which is mermaid's walk of them, parents first.
  const colorIndex = everySubgraph(graph.subgraphs).length;
  const sg = makeSubgraph(stripQuotes(id), titleOf(label), { parent, colorIndex });
  if (parent === undefined) graph.subgraphs.push(sg);
  else parent.children.push(sg);
  stack.push(sg);
}

// A title as mermaid 12 draws it: a row per `<br>`, its references resolved, a markdown string's markers and the
// `<b>` `<i>` tags taken off, their weight left undrawn.
function titleOf(written: string): string {
  const label = boxLabel(unIconed(written.trim()));
  const bare = stripQuotes(label);
  return (parseMarkdownLabel(label) ?? taggedSegments(bare))?.plain ?? bare;
}

export function readDirectionOverride(stack: Subgraph[], written: string): void {
  const current = stack[stack.length - 1];
  const declared = directionOf(written);
  if (current !== undefined && declared !== undefined) current.direction = declared;
}

// One parent per node, and the subgraph that CLOSES first keeps it: mermaid fills its map from the last subgraph
// back to the first, each write overwriting the one before (`getSubGraphs`, 11.17.0).
export function registerInSubgraph(graph: Graph, stack: Subgraph[], nodeId: string): void {
  const sg = stack[stack.length - 1];
  if (sg === undefined || sg.nodeIds.includes(nodeId)) return;

  const tenant = graph.findSubgraphForNode(nodeId);
  if (tenant !== undefined) {
    if (!stack.includes(tenant)) return;
    tenant.nodeIds.splice(tenant.nodeIds.indexOf(nodeId), 1);
  }
  sg.nodeIds.push(nodeId);
}

export function collapseGroups(graph: Graph): void {
  const boxes = everySubgraph(graph.subgraphs);
  const folded = boxes.filter((sg) => {
    if (!sg.collapsed) return false;
    for (let at = sg.parent; at !== undefined; at = at.parent) if (at.collapsed) return false;
    return true;
  });
  if (folded.length === 0) return;

  const standIn = new Map<string, string>();
  for (const sg of folded) {
    const hide = (box: Subgraph): void => {
      for (const id of box.nodeIds) standIn.set(id, sg.id);
      for (const child of box.children) {
        standIn.set(child.id, sg.id);
        hide(child);
      }
    };
    hide(sg);
  }

  for (const sg of folded) {
    const siblings = sg.parent === undefined ? graph.subgraphs : sg.parent.children;
    const at = siblings.indexOf(sg);
    if (at !== -1) siblings.splice(at, 1);
    if (sg.parent !== undefined) sg.parent.nodeIds.push(sg.id);

    const seats = [...standIn]
      .filter(([, owner]) => owner === sg.id)
      .map(([id]) => graph.nodeOrder.indexOf(id))
      .filter((index) => index !== -1);
    const seat = seats.length > 0 ? Math.min(...seats) : graph.nodeOrder.length;
    graph.nodes.set(sg.id, makeNode(sg.id, sg.label, { shape: NodeShape.COLLAPSED_GROUP }));
    graph.nodeOrder.splice(seat, 0, sg.id);
  }

  for (const id of standIn.keys()) {
    graph.nodes.delete(id);
    const at = graph.nodeOrder.indexOf(id);
    if (at !== -1) graph.nodeOrder.splice(at, 1);
  }

  const drawn = new Set(folded.map((sg) => sg.id));
  graph.edges = graph.edges.filter((edge) => {
    const source = standIn.get(edge.source);
    const target = standIn.get(edge.target);
    if (source !== undefined) edge.source = source;
    if (target !== undefined) edge.target = target;
    if (drawn.has(edge.source)) edge.sourceIsSubgraph = false;
    if (drawn.has(edge.target)) edge.targetIsSubgraph = false;
    return edge.source !== edge.target || (source === undefined && target === undefined);
  });
}
