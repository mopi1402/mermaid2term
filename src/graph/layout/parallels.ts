import { isHorizontal, normalized, type Edge, type Graph } from "../model.js";
import { axisOf } from "../axis.js";
import { placedEdges } from "./edges.js";
import { labelLines, widestLabelLine } from "../../text/labels.js";
import { MAX_SPREAD_STEP, type GridLayout, type Pitch } from "./grid.js";

export const pairOf = (edge: Edge): string => [edge.source, edge.target].sort().join("|");

// Links run across the page set each label above its own run; links run down set the first label left of its run,
// every other right of its own.
function parallelPitch(labels: readonly string[], acrossPage: boolean, air: number): Pitch | undefined {
  if (labels.length < 2 || labels.every((label) => label === "")) return undefined;
  const reach = (label: string): number => (label === "" ? 0 : acrossPage ? labelLines(label) : widestLabelLine(label) + air);
  const steps = labels.slice(1).map((next, i) => {
    const label = acrossPage ? next : i === 0 ? "" : labels[i];
    return label === "" ? MAX_SPREAD_STEP : reach(label) + (acrossPage ? 1 : 2);
  });
  const before = Math.max(0, reach(labels[0]) - 1);
  const after = acrossPage ? 0 : Math.max(0, reach(labels[labels.length - 1]) - 1);
  return { steps, before, after, cells: before + 1 + steps.reduce((sum, step) => sum + step, 0) + after };
}

function parallelGroups(graph: Graph, layout: GridLayout): Map<string, Edge[]> {
  const { along, across } = axisOf(isHorizontal(normalized(graph.direction)));
  const groups = new Map<string, Edge[]>();
  for (const { edge, src, tgt } of placedEdges(graph, layout)) {
    if (edge.source === edge.target || across(src) !== across(tgt) || along(src) === along(tgt)) continue;
    const group = groups.get(pairOf(edge)) ?? [];
    group.push(edge);
    groups.set(pairOf(edge), group);
  }
  return groups;
}

export function expandNodesForParallels(graph: Graph, layout: GridLayout, air: number): void {
  const horizontal = isHorizontal(normalized(graph.direction));
  const { across } = axisOf(horizontal);
  const sizes = horizontal ? layout.rowHeights : layout.colWidths;
  layout.parallels.clear();
  for (const group of parallelGroups(graph, layout).values()) {
    const pitch = parallelPitch(group.map((edge) => edge.label), horizontal, air);
    const placement = layout.placements.get(group[0].source);
    if (pitch === undefined || placement === undefined) continue;
    layout.parallels.set(pairOf(group[0]), pitch);
    const track = across(placement);
    sizes.set(track, Math.max(sizes.get(track) ?? 0, pitch.cells));
  }
}
