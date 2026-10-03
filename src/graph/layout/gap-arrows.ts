import { isHorizontal, normalized, type Graph } from "../model.js";
import { axisOf } from "../axis.js";
import { placedEdges } from "./edges.js";
import { headAdvances } from "./padless.js";
import { type GridLayout } from "./grid.js";
import { alongReversedNodes } from "./ordering/subgraph-flow.js";

const LINE_CELL = 1;

export const TURN_CELLS = 3;

interface HeadsInGap {
  low: boolean;
  high: boolean;
  advancedLow: boolean;
  advancedHigh: boolean;
  turns: boolean;
}

const cellsNeeded = (heads: HeadsInGap): number =>
  Math.max((heads.low ? 1 : 0) + (heads.high ? 1 : 0) + LINE_CELL, heads.turns ? TURN_CELLS : 0);

function landBeside(heads: Map<number, HeadsInGap>, at: number, advanced: boolean): void {
  if (at >= 2) landHead(heads, at - 2, false, true, advanced);
  landHead(heads, at + 2, true, true, advanced);
}

function landHead(heads: Map<number, HeadsInGap>, at: number, low: boolean, turns: boolean, advanced: boolean): void {
  const found = heads.get(at) ?? { low: false, high: false, advancedLow: false, advancedHigh: false, turns: false };
  if (advanced) {
    if (low) found.advancedLow = true;
    else found.advancedHigh = true;
  } else if (low) found.low = true;
  else found.high = true;
  found.turns = found.turns || turns;
  heads.set(at, found);
}

const cellsFreed = (heads: HeadsInGap): number => (heads.advancedLow && !heads.low ? 1 : 0) + (heads.advancedHigh && !heads.high ? 1 : 0);

export function expandGapsForArrows(graph: Graph, layout: GridLayout, gap: number, padless: { paddingX: number; paddingY: number } | undefined): void {
  const horizontal = isHorizontal(normalized(graph.direction));
  const inColumns = new Map<number, HeadsInGap>();
  const inRows = new Map<number, HeadsInGap>();
  const advances = (id: string, alongFlow: boolean): boolean => {
    const node = graph.nodes.get(id);
    if (padless === undefined || node === undefined) return false;
    const sideways = alongFlow === horizontal;
    return headAdvances(graph, layout, node, sideways, padless.paddingX);
  };

  const reversed = alongReversedNodes(graph);
  const mirrored = (a: string, b: string): boolean => reversed.some((members) => members.has(a) && members.has(b));

  for (const { edge, src: source, tgt: target } of placedEdges(graph, layout)) {
    const axis = axisOf(horizontal);
    const flow = [axis.along(source), axis.along(target)];
    const across = [axis.across(source), axis.across(target)];
    const [flowFrom, flowTo] = flow;
    const [acrossFrom, acrossTo] = across;

    // Inside a subgraph laid against the flow, an edge climbing the layers still runs straight between its ends.
    const forward = flowFrom < flowTo || mirrored(edge.source, edge.target);
    const alongFlow = flowFrom !== flowTo && forward;
    const [from, to] = alongFlow ? [flowFrom, flowTo] : [acrossFrom, acrossTo];

    const heads = alongFlow === horizontal ? inColumns : inRows;
    const turns = flowFrom !== flowTo && acrossFrom !== acrossTo;

    if (flowFrom > flowTo && !forward) {
      if (edge.hasArrowStart) landBeside(heads, acrossFrom, advances(edge.source, false));
      if (edge.hasArrowEnd) landBeside(heads, acrossTo, advances(edge.target, false));
      continue;
    }
    if (from === to) continue;

    const goes = from < to;
    const step = goes ? 2 : -2;
    if (edge.hasArrowStart) landHead(heads, from + step, goes, turns, advances(edge.source, alongFlow));
    if (edge.hasArrowEnd) landHead(heads, to - step, !goes, turns, advances(edge.target, alongFlow));
  }

  const sized = (current: number | undefined, heads: HeadsInGap): number => {
    const floor = cellsNeeded(heads);
    const freed = cellsFreed(heads);
    if (freed > 0 && current === gap) return Math.max(floor, gap - freed);
    return Math.max(current ?? 0, floor);
  };
  for (const [at, heads] of inColumns) layout.colWidths.set(at, sized(layout.colWidths.get(at), heads));
  for (const [at, heads] of inRows) {
    const asked = sized(layout.rowHeights.get(at), heads);
    layout.rowHeights.set(at, asked);
    layout.gapHeads.set(at, { low: heads.low, high: heads.high, asked });
  }
}
