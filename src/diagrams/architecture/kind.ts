import { charsetOf } from "../../canvas/charsets.js";
import { HEAVY_FROM_WIDTH } from "../../canvas/strokes.js";
import { EdgeStyle, type Graph } from "../../graph/model.js";
import { everySubgraph } from "../../graph/subgraph-tree.js";
import { PROP_STROKE_DASHARRAY, PROP_STROKE_WIDTH } from "../../source/css.js";
import { kind, onGraph, type ThemeFacts } from "../@common/kind.js";
import { parseArchitecture } from "./parser.js";

// mermaid's `.node-bkg`: a group's frame dashed 8, as wide as `archGroupBorderWidth`.
const GROUP_DASH = "8";

// mermaid's architecture stylesheet weighs every edge `archEdgeWidth` and every group's frame
// `archGroupBorderWidth`, read here as any written width is: heavy from 2 up.
function weighed(graph: Graph, facts: ThemeFacts): void {
  const edgeWidth = Number.parseFloat(facts.archEdgeWidth ?? "");
  if (edgeWidth >= HEAVY_FROM_WIDTH) for (const edge of graph.edges) edge.style = EdgeStyle.THICK;
  const frame = new Map([[PROP_STROKE_DASHARRAY, GROUP_DASH]]);
  if (facts.archGroupBorderWidth !== undefined) frame.set(PROP_STROKE_WIDTH, facts.archGroupBorderWidth);
  for (const group of everySubgraph(graph)) group.props = frame;
}

export const ARCHITECTURE = kind("architecture", (text, o, budget, _direction, painting) => {
  const graph = parseArchitecture(text, charsetOf(o.charset).icons);
  if (painting !== undefined) weighed(graph, painting);
  return onGraph(graph, o, budget);
});
