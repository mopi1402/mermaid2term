import { type Edge, type Graph } from "../model.js";
import { boxesUnder } from "../subgraph-tree.js";
import { type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { NO_CELLS, type CellSet } from "./pathfinder.js";
import { subgraphMembers } from "./endpoints.js";

// A frame's grid cells told by a rule: poured into a set per frame, nested frames spent a cell for every level they
// sit in, cubic in the depth.
function cellRect(minCol: number, maxCol: number, minRow: number, maxRow: number): CellSet {
  return {
    has: (cell) => {
      const comma = cell.indexOf(",");
      if (comma === -1) return false;
      const c = Number(cell.slice(0, comma));
      const r = Number(cell.slice(comma + 1));
      return Number.isInteger(c) && Number.isInteger(r) && c >= minCol && c <= maxCol && r >= minRow && r <= maxRow;
    },
  };
}

export function computeSgRegions(layout: GridLayout, sgBounds: ReadonlyMap<string, SubgraphBounds>): Map<string, CellSet> {
  const regions = new Map<string, CellSet>();
  for (const [id, sb] of sgBounds) {
    const members = subgraphMembers(sb, layout);
    if (members.length === 0) continue;
    const cols = members.map((p) => p.grid.col);
    const rows = members.map((p) => p.grid.row);
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
    regions.set(id, cellRect(Math.min(...cols) - 1, maxCol, Math.min(...rows) - 1, maxRow));
  }
  return regions;
}

// The boxes are named and never COPIED: poured into one set per edge, a drawing with big boxes spent every
// foreign region again for each edge, for a question the search then asks of a few dozen cells.
export function foreignSgCells(edge: Edge, graph: Graph, regions: ReadonlyMap<string, CellSet>): CellSet {
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

  const foreign: CellSet[] = [];
  for (const [id, region] of regions) if (!allowed.has(id)) foreign.push(region);
  if (foreign.length === 0) return NO_CELLS;
  return {
    has: (cell) => {
      for (const region of foreign) if (region.has(cell)) return true;
      return false;
    },
  };
}
