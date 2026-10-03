import { axisOf } from "../axis.js";
import { EdgeStyle, normalized, type Edge, type Graph } from "../model.js";
import { AttachDir, preferredSides, SELF_LOOP_SIDES } from "../sides.js";
import type { GridLayout } from "./grid.js";
import type { NodePlacement } from "./laid.js";

interface PlacedEdge {
  edge: Edge;
  src: NodePlacement;
  tgt: NodePlacement;
}

export function* placedEdges(graph: Graph, layout: GridLayout, options: { invisible?: boolean } = {}): Generator<PlacedEdge> {
  for (const edge of graph.edges) {
    if (edge.style === EdgeStyle.INVISIBLE && options.invisible !== true) continue;
    const src = layout.placements.get(edge.source);
    const tgt = layout.placements.get(edge.target);
    if (src === undefined || tgt === undefined) continue;
    yield { edge, src, tgt };
  }
}

interface EdgeSides {
  edge: Edge;
  src: NodePlacement | undefined;
  tgt: NodePlacement | undefined;
  from: AttachDir | undefined;
  to: AttachDir | undefined;
}

export function* edgeSides(graph: Graph, layout: GridLayout): Generator<EdgeSides> {
  const direction = normalized(graph.direction);
  const axis = axisOf(direction);
  for (const edge of graph.edges) {
    if (edge.style === EdgeStyle.INVISIBLE) continue;
    const src = layout.placements.get(edge.source);
    const tgt = layout.placements.get(edge.target);
    if (src !== undefined && tgt !== undefined) {
      const [from, to] = edge.source === edge.target ? SELF_LOOP_SIDES : preferredSides(src, tgt, layout, direction);
      yield { edge, src, tgt, from, to };
    } else if (src === undefined && tgt !== undefined && edge.sourceIsSubgraph) {
      yield { edge, src, tgt, from: undefined, to: axis.behind };
    } else if (src !== undefined && tgt === undefined && edge.targetIsSubgraph) {
      yield { edge, src, tgt, from: axis.ahead, to: undefined };
    }
  }
}

export const isWall = (side: AttachDir): boolean => side === AttachDir.LEFT || side === AttachDir.RIGHT;
