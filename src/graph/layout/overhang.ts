import { cellId } from "../../canvas/geometry.js";
import { type Graph } from "../model.js";
import { placedEdges } from "./edges.js";
import { NodeShape, BARS, STATE_MARKS } from "../shapes.js";
import { type GridLayout, UNSIZED } from "./grid.js";
import { type NodePlacement } from "./laid.js";
import { hangMeasure, hangOf, trackContents, type Hang } from "./boxes.js";

export interface Borrowed {
  cols: number;
  rows: number;
}

export const NOTHING_BORROWED: Borrowed = { cols: 0, rows: 0 };

export interface Reach {
  left: number;
  right: number;
}

export function overhangCandidates(graph: Graph, layout: GridLayout, denied: ReadonlySet<string> = new Set()): Map<string, Reach> {
  const hang = hangOf(graph);
  const found = new Map<string, Reach>();
  const homes = new Map<string, string>();
  const home = (id: string): string => {
    const known = homes.get(id);
    if (known !== undefined) return known;
    const own = graph.findSubgraphForNode(id)?.id ?? "";
    homes.set(id, own);
    return own;
  };
  const trackHomes = new Map<number, Set<string>>();
  for (const [id, p] of layout.placements) {
    const own = home(id);
    const at = hang.over(p);
    for (let d = -1; d <= 1; d++) {
      const set = trackHomes.get(at + d) ?? new Set<string>();
      set.add(own);
      trackHomes.set(at + d, set);
    }
  }
  const standing = new Set([...layout.placements.values()].map((p) => hang.over(p)));
  const passing = new Map<number, Set<number>>();
  for (const { src, tgt } of placedEdges(graph, layout)) {
    if (hang.along(src) >= hang.along(tgt)) continue;
    for (let line = hang.along(src) + 1; line < hang.along(tgt); line++) {
      const tracks = passing.get(line) ?? new Set<number>();
      for (const c of [hang.over(src), hang.over(tgt)]) for (let d = -1; d <= 1; d++) tracks.add(c + d);
      passing.set(line, tracks);
    }
  }
  const claimed = new Set<string>();
  for (const id of graph.nodeOrder) {
    const p = layout.placements.get(id);
    const node = graph.nodes.get(id);
    if (p === undefined || node === undefined || denied.has(id)) continue;
    const over = hang.over(p);
    const along = hang.along(p);
    if (!standing.has(over - 2) || !standing.has(over + 2)) continue;
    const busy = passing.get(along) ?? new Set<number>();
    if (node.shape === NodeShape.JUNCTION || BARS.has(node.shape) || STATE_MARKS.has(node.shape) || node.shape === NodeShape.LOLLIPOP) continue;
    if (layout.drums.has(id)) continue;
    const own = home(id);
    const reach = (step: number): number => {
      let tracks = 0;
      for (let t = over + 2 * step; ; t += step) {
        if (t < 0 || !layout.isFree(...hang.cell(t, along)) || claimed.has(cellId(...hang.cell(t, along))) || busy.has(t)) break;
        const homes = trackHomes.get(t);
        if (homes !== undefined && (homes.size > 1 || !homes.has(own))) break;
        tracks += 1;
        if (tracks >= OVERHANG_REACH) break;
      }
      return tracks;
    };
    const sides = { left: reach(-1), right: reach(1) };
    if (sides.left === 0 || sides.right === 0) continue;
    for (let t = 1; t <= sides.left; t++) claimed.add(cellId(...hang.cell(over - 1 - t, along)));
    for (let t = 1; t <= sides.right; t++) claimed.add(cellId(...hang.cell(over + 1 + t, along)));
    found.set(id, sides);
  }
  return found;
}

const OVERHANG_REACH = 4;

export function borrowable(hang: Hang, layout: GridLayout, p: NodePlacement, sides: Reach, estimates: ReadonlyMap<number, number> = new Map()): number {
  const over = hang.over(p);
  const sizes = hang.sizes(layout);
  const held = (step: number, tracks: number): number => {
    let measure = 0;
    for (let t = 1; t <= tracks; t++) {
      const at = over + step * (1 + t);
      measure += sizes.get(at) ?? estimates.get(at) ?? 0;
    }
    return measure;
  };
  return 2 * Math.min(held(-1, sides.left), held(1, sides.right));
}

export function overhangsUnheld(
  graph: Graph,
  layout: GridLayout,
  paddingX: number,
  paddingY: number,
  padless: boolean,
  denied: ReadonlySet<string> = new Set()
): Set<string> {
  const hang = hangOf(graph);
  const unheld = new Set<string>();
  const trackContent = trackContents(graph, layout, paddingX, paddingY, padless);
  for (const [id, sides] of overhangCandidates(graph, layout, denied)) {
    const p = layout.placements.get(id);
    const node = graph.nodes.get(id);
    if (p === undefined || node === undefined || !p.overhangs) continue;
    const extra =
      hangMeasure(node, p, layout, hang, trackContent, paddingX, paddingY, padless) - (hang.sizes(layout).get(hang.over(p)) ?? UNSIZED);
    if (extra <= 0) continue;
    if (borrowable(hang, layout, p, sides) < extra) unheld.add(id);
  }
  return unheld;
}
