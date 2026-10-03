import { type Edge, type Graph } from "../model.js";
import { boxesUnder } from "../subgraph-tree.js";
import { type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { cellId, NO_CELLS, type CellSet } from "./pathfinder.js";
import { subgraphMembers } from "./endpoints.js";

export function computeSgRegions(layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>): Map<string, Set<string>> {
  const regions = new Map<string, Set<string>>();
  for (const [id, sb] of sgBounds) {
    const members = subgraphMembers(sb, layout);
    if (members.length === 0) continue;
    const cols = members.map((p) => p.grid.col);
    const rows = members.map((p) => p.grid.row);
    const region = new Set<string>();
    const right = sb.x + sb.width;
    const bottom = sb.y + sb.height;
    const lastCol = (): number => {
      let c = Math.max(...cols) + 1;
      while (layout.gridToDraw(c + 1, 0)[0] < right) c++;
      return c;
    };
    const lastRow = (): number => {
      let r = Math.max(...rows) + 1;
      while (layout.gridToDraw(0, r + 1)[1] < bottom) r++;
      return r;
    };
    const maxCol = lastCol();
    const maxRow = lastRow();
    for (let c = Math.min(...cols) - 1; c <= maxCol; c++) {
      for (let r = Math.min(...rows) - 1; r <= maxRow; r++) region.add(cellId(c, r));
    }
    regions.set(id, region);
  }
  return regions;
}

// The boxes are named and never COPIED: poured into one set per edge, a drawing with big boxes spent every
// foreign region again for each edge, for a question the search then asks of a few dozen cells.
export function foreignSgCells(edge: Edge, graph: Graph, regions: Map<string, Set<string>>): CellSet {
  if (regions.size === 0) return NO_CELLS;

  const allowed = new Set<string>();
  for (const [endpoint, isSubgraph] of [
    [edge.source, edge.sourceIsSubgraph],
    [edge.target, edge.targetIsSubgraph],
  ] satisfies Array<[string, boolean]>) {
    if (isSubgraph) {
      const found = graph.findSubgraphById(endpoint);
      if (found !== undefined) for (const box of boxesUnder(found)) allowed.add(box.id);
      let up = found;
      while (up !== undefined) {
        allowed.add(up.id);
        up = up.parent;
      }
    } else {
      let sg = graph.findSubgraphForNode(endpoint);
      while (sg !== undefined) {
        allowed.add(sg.id);
        sg = sg.parent;
      }
    }
  }

  const foreign: Array<ReadonlySet<string>> = [];
  for (const [id, region] of regions) if (!allowed.has(id)) foreign.push(region);
  if (foreign.length === 0) return NO_CELLS;
  return {
    has: (cell) => {
      for (const region of foreign) if (region.has(cell)) return true;
      return false;
    },
  };
}
