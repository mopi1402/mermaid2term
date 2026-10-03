import { type Graph } from "../model.js";
import { type GridLayout } from "../layout/grid.js";
import type { Point } from "../../canvas/cells.js";
import { routeEdges } from "./router.js";
import { type RoutedEdge } from "./routed.js";

// The runs each layout was routed with, keyed by all the router reads of it: every field but the boxes' label text.
export type Routes = Map<string, readonly RoutedEdge[]>;

const routeKey = (layout: GridLayout): string => {
  const { labels: _text, ...read } = layout;
  return JSON.stringify(read, (key, value: unknown) => {
    if (value instanceof Map || value instanceof Set) return [...value];
    return key === "subgraph" && value instanceof Object && "id" in value ? value.id : value;
  });
};

const copied = (re: RoutedEdge): RoutedEdge => ({
  ...re,
  gridPath: re.gridPath.map(([c, r]): Point => [c, r]),
  drawPath: re.drawPath.map(([x, y]): [number, number] => [x, y]),
  occupiedCells: new Set(re.occupiedCells),
});

// A fold search redraws layouts that differ from one another in a label's text alone, and the router never reads
// it: each such layout is routed once. A layout the router wrote to is never kept, its replay would miss the write.
export function routedOnce(graph: Graph, layout: GridLayout, upward: boolean, routes: Routes | undefined): RoutedEdge[] {
  if (routes === undefined) return routeEdges(graph, layout, upward);
  const keyOf = (): string => `${upward}${routeKey(layout)}`;
  const key = keyOf();
  const known = routes.get(key);
  if (known !== undefined) return known.map(copied);
  const routed = routeEdges(graph, layout, upward);
  if (keyOf() === key) routes.set(key, routed.map(copied));
  return routed;
}
