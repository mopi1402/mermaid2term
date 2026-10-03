import { isHorizontal, normalized, type Graph } from "../model.js";
import { placedEdges } from "./edges.js";
import { labelLines, widestLabelLine } from "../../text/labels.js";
import { wallHugsContent } from "./padless.js";
import { chainOf } from "../subgraph-tree.js";
import { STRIDE, type GridLayout, SG_BORDER_PAD } from "./grid.js";
import { DEFAULT_GAP } from "../../options.js";
import { TURN_CELLS } from "./gap-arrows.js";
import { symmetricDifference } from "./gap-frames.js";
import { pairOf } from "./parallels.js";
import { LOOP_TURN, loopNests } from "../self-loops.js";

const LABEL_GAP_ROWS = 3;

const ROWS_PER_LABEL = 2;

export function expandGapsForEdgeLabels(graph: Graph, layout: GridLayout, padless = false, airyLabels = true): void {
  const horizontal = isHorizontal(normalized(graph.direction));
  const roomAcross = (label: number, sourceId: string, targetId: string, sourceFirst: boolean): number => {
    if (!padless) return label + 1;
    const [leftId, rightId] = sourceFirst ? [sourceId, targetId] : [targetId, sourceId];
    const leftNode = graph.nodes.get(leftId);
    const rightNode = graph.nodes.get(rightId);
    if (!airyLabels || leftNode === undefined || rightNode === undefined) return label + 2;
    const air = (wallHugsContent(leftNode, layout, padless) ? 0 : 1) + (wallHugsContent(rightNode, layout, padless) ? 0 : 1);
    return label + 2 + air;
  };
  const throughWall = (a: string, b: string): boolean => symmetricDifference(chainOf(graph, a), chainOf(graph, b)) > 0;
  layout.gapLabelCols.clear();
  const besideTall = new Map<number, number>();
  const labelRows = LABEL_GAP_ROWS + (padless ? 1 : 0);
  const air = padless && airyLabels ? 1 : 0;

  // Loops nested round one box take the gap past it for every turn and the last one's label, and one row over the
  // box for every loop past the first.
  for (const [index, nest] of loopNests(graph)) {
    const edge = graph.edges[index];
    const box = layout.placements.get(edge.source);
    if (box === undefined || nest.count < 2 || nest.rank !== nest.count - 1) continue;
    const at = box.grid.col + 2;
    const last = edge.label === "" ? 0 : widestLabelLine(edge.label) + 1;
    if (layout.colWidths.has(at)) layout.colWidths.set(at, Math.max(layout.colWidths.get(at) ?? DEFAULT_GAP, LOOP_TURN + nest.reach + last + 1));
    const over = box.grid.row - 2;
    if (over >= 0) layout.rowHeights.set(over, Math.max(layout.rowHeights.get(over) ?? 1, nest.count + 1));
    // The box itself grows to seat every loop apart: two lid cells each, past the lid's middle down the page where
    // the runs arrive.
    const { col, row } = box.grid;
    const wide = horizontal ? 2 * nest.count + 2 : 4 * nest.count + 4;
    // A wall row for each loop and, across the page, one more for each run leaving the wall they come back on.
    const leaving = horizontal ? graph.edges.filter((e) => e.source === edge.source && e.target !== edge.source).length : 0;
    const tall = nest.count + 2 + leaving;
    const rims = (sizes: Map<number, number>, at: number): number => (sizes.get(at - 1) ?? 1) + (sizes.get(at + 1) ?? 1);
    layout.colWidths.set(col, Math.max(layout.colWidths.get(col) ?? 1, wide - rims(layout.colWidths, col)));
    layout.rowHeights.set(row, Math.max(layout.rowHeights.get(row) ?? 1, tall - rims(layout.rowHeights, row)));
  }

  for (const { edge, src: source, tgt: target } of placedEdges(graph, layout)) {
    if (edge.label === "") continue;
    const labelLength = widestLabelLine(edge.label);
    const tall = labelLines(edge.label) - 1;

    if (edge.source === edge.target) {
      const at = source.grid.col + 2;
      if (layout.colWidths.has(at)) {
        // Down the page the loop turns in the middle of the gap: a box standing just past it leaves the label only
        // the half beyond the turn, so the gap takes the label twice.
        const walled = !horizontal && [...layout.placements.values()].some((p) => p.grid.row === source.grid.row && p.grid.col === at + 2);
        const past = walled ? 2 * (labelLength + 1) + 1 : 0;
        layout.colWidths.set(at, Math.max(layout.colWidths.get(at) ?? DEFAULT_GAP, labelLength + TURN_CELLS + 1, past));
      }
      continue;
    }

    if (horizontal && source.grid.col === target.grid.col && tall > 0) {
      // Down a rank a label beside the run stands in the gap between the two boxes, one row more per row it adds.
      const gap = Math.min(source.grid.row, target.grid.row) + 2;
      if (gap <= Math.max(source.grid.row, target.grid.row) - 2) besideTall.set(gap, Math.max(besideTall.get(gap) ?? 0, tall));
      continue;
    }

    if (horizontal) {
      const start = Math.min(source.grid.col, target.grid.col) + 2;
      const end = Math.max(source.grid.col, target.grid.col) - 2;
      if (start > end) continue;
      const room = roomAcross(labelLength, edge.source, edge.target, source.grid.col < target.grid.col);
      layout.colWidths.set(start, Math.max(layout.colWidths.get(start) ?? DEFAULT_GAP, room));
      if (throughWall(edge.source, edge.target)) layout.gapLabelCols.set(start, Math.max(layout.gapLabelCols.get(start) ?? 0, room));
      continue;
    }

    if (source.grid.row === target.grid.row) {
      const at = Math.min(source.grid.col, target.grid.col) + 2;
      if (at === Math.max(source.grid.col, target.grid.col) - 2) {
        const room = roomAcross(labelLength, edge.source, edge.target, source.grid.col < target.grid.col);
        layout.colWidths.set(at, Math.max(layout.colWidths.get(at) ?? DEFAULT_GAP, room));
        if (throughWall(edge.source, edge.target)) layout.gapLabelCols.set(at, Math.max(layout.gapLabelCols.get(at) ?? 0, room));
      }
      continue;
    }

    const start = Math.min(source.grid.row, target.grid.row) + 2;
    const end = Math.max(source.grid.row, target.grid.row) - 2;
    if (start > end) continue;
    layout.rowHeights.set(start, Math.max(layout.rowHeights.get(start) ?? labelRows, labelRows + tall));
    const booked = Math.max(layout.gapLabelRows.get(start)?.tall ?? 0, tall);
    layout.gapLabelRows.set(start, { rows: labelRows + booked, tall: booked });

    const gapCols = new Set<number>();
    if (target.grid.col >= source.grid.col) gapCols.add(source.grid.col + 2);
    if (target.grid.col <= source.grid.col) gapCols.add(source.grid.col - 2);
    const low = Math.min(source.grid.col, target.grid.col);
    const high = Math.max(source.grid.col, target.grid.col);
    for (let c = low + 2; c < high; c += STRIDE) gapCols.add(c);
    if (target.grid.col === source.grid.col) continue;
    for (const c of gapCols) {
      if (c < 0) continue;
      if (!layout.colWidths.has(c) && c !== source.grid.col + 2) continue;
      layout.colWidths.set(c, Math.max(layout.colWidths.get(c) ?? DEFAULT_GAP, labelLength + 1 + air));
    }
  }
  for (const [gap, tall] of besideTall) layout.rowHeights.set(gap, (layout.rowHeights.get(gap) ?? 1) + tall);
  if (horizontal) return;

  const labelled = new Map<string, { count: number; rows: number }>();
  for (const { edge, src: source, tgt: target } of placedEdges(graph, layout)) {
    if (edge.label === "") continue;
    if (target.grid.row <= source.grid.row) continue;
    if (target.grid.col !== source.grid.col || layout.parallels.has(pairOf(edge))) continue;
    const got = labelled.get(edge.source) ?? { count: 0, rows: 0 };
    labelled.set(edge.source, { count: got.count + 1, rows: got.rows + ROWS_PER_LABEL + labelLines(edge.label) - 1 });
  }
  for (const [id, { count, rows }] of labelled) {
    if (count < 2) continue;
    const source = layout.placements.get(id);
    if (source === undefined) continue;
    const gapRow = source.grid.row + 2;
    const needed = rows + 1;
    layout.rowHeights.set(gapRow, Math.max(layout.rowHeights.get(gapRow) ?? LABEL_GAP_ROWS, needed));
  }
}

export function expandGapsForLabelSpill(graph: Graph, layout: GridLayout, padless = false, airyLabels = true): void {
  const air = padless && airyLabels ? 1 : 0;
  // Across the ranks a label beside a run spills into the gap between ranks, which only a frame's wall can close.
  const framedOnly = isHorizontal(normalized(graph.direction));
  const pairs = new Map<string, { col: number; need: number; boxed: boolean }>();
  for (const { edge, src: source, tgt: target } of placedEdges(graph, layout)) {
    if (edge.label === "" || edge.source === edge.target) continue;
    if (target.grid.col !== source.grid.col || target.grid.row === source.grid.row) continue;
    const key = [edge.source, edge.target].sort().join("|");
    const got = pairs.get(key);
    const boxed = chainOf(graph, edge.source).size > 0;
    if (framedOnly && !boxed) continue;
    pairs.set(key, { col: source.grid.col, need: Math.max(got?.need ?? 0, widestLabelLine(edge.label) + 1 + air), boxed });
  }
  const beside = new Map<number, { low: number; high: number }>();
  for (const { col, need, boxed } of pairs.values()) {
    const width = (layout.colWidths.get(col) ?? 0) + 2;
    const reach = need + 1 + (boxed ? SG_BORDER_PAD : 0);
    const spill = Math.max(1, Math.floor(width / 2) + 1 + reach - width);
    for (const c of [col - 2, col + 2]) {
      if (c < 0) continue;
      if (!layout.colWidths.has(c) && c !== col + 2) continue;
      const got = beside.get(c) ?? { low: 0, high: 0 };
      if (c < col) got.high += spill;
      else got.low += spill;
      beside.set(c, got);
    }
  }
  for (const [c, room] of beside) {
    layout.labelRoom.set(c, room);
    layout.colWidths.set(c, Math.max(layout.colWidths.get(c) ?? DEFAULT_GAP, room.low + room.high));
  }

}
