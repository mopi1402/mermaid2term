import { NodeShape } from "../shapes.js";
import { Direction, type Graph } from "../model.js";
import { axisOf, type Axis } from "../axis.js";
import { placedEdges } from "./edges.js";
import { TURN_CELLS } from "./gap-arrows.js";
import { frameRoom, type FrameRoom, type GridLayout } from "./grid.js";
import { must, pushInto } from "../../must.js";
import { boxesUnder, chainOf, everySubgraph, membersOf } from "../subgraph-tree.js";
import { widenSpan } from "./spans.js";

const UNSIZED_ROW = 1;
const UNSIZED_COL = 2;
const SG_APPROACH = 1;
const TIGHT_LABEL_LANES = 2;

export function symmetricDifference(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let count = 0;
  for (const id of a) if (!b.has(id)) count++;
  for (const id of b) if (!a.has(id)) count++;
  return count;
}

// A run reaching a box on the frame's first row is written over by the label on the way in, and its head then
// lands on the row under the name with no shaft to carry it. The frames it happens to are named here, before any
// room is counted, so `frameRoom` opens their lid by the one row the run needs to show again below the label.
export function markCrossedLabels(graph: Graph, layout: GridLayout, direction: Direction): void {
  layout.crossedLabels.clear();
  layout.labelStems.clear();
  const axis = axisOf(direction);
  if (graph.subgraphs.length === 0 || axis.horizontal) return;
  // An upward frame is laid top down and turned over, its label then standing on the row the grid reads as its last.
  const up = layout.upward;
  const nearer = (a: number, b: number): boolean => (up ? a > b : a < b);

  const rowOf = (id: string): number | undefined => {
    const p = layout.placements.get(id);
    return p === undefined ? undefined : axis.along(p);
  };
  const rowsOf = (ids: Iterable<string>): number[] => [...ids].map(rowOf).filter((row): row is number => row !== undefined);
  const leavesAt = (id: string, isSubgraph: boolean): number | undefined => {
    if (!isSubgraph) return rowOf(id);
    const sg = graph.findSubgraphById(id);
    const rows = sg === undefined ? [] : rowsOf(membersOf(sg));
    return rows.length === 0 ? undefined : rows.reduce((last, row) => (nearer(last, row) ? row : last));
  };

  for (const sg of everySubgraph(graph)) {
    if (sg.label === "") continue;
    const members = membersOf(sg);
    const rows = rowsOf(members);
    if (rows.length === 0) continue;
    const top = rows.reduce((low, row) => (nearer(row, low) ? row : low));
    // A nested frame on that row opens above its own content, so this label is no longer the head's neighbour.
    if (sg.children.some((child) => [...membersOf(child)].some((id) => rowOf(id) === top))) continue;
    const arrivals = new Set(sg.nodeIds.filter((id) => rowOf(id) === top));
    if (arrivals.size === 0) continue;
    const held = new Set<string>([...members, ...boxesUnder(sg).map((box) => box.id)]);
    const beyond = (id: string, isSubgraph: boolean): boolean => {
      const at = leavesAt(id, isSubgraph);
      return !held.has(id) && at !== undefined && nearer(at, top);
    };
    const crossed = graph.edges.filter((edge) => !edge.targetIsSubgraph && arrivals.has(edge.target) && beyond(edge.source, edge.sourceIsSubgraph));
    if (crossed.some((edge) => edge.hasArrowEnd)) layout.crossedLabels.add(sg.id);
    const left = graph.edges.filter((edge) => !edge.sourceIsSubgraph && arrivals.has(edge.source) && beyond(edge.target, edge.targetIsSubgraph));
    const stems = [...crossed.map((edge) => edge.target), ...left.map((edge) => edge.source)];
    if (stems.length > 0) layout.labelStems.set(sg.id, [...new Set(stems)]);
  }
}

// What every frame asks of the gaps around it, read along or across the flow.
interface Frames {
  readonly graph: Graph;
  readonly layout: GridLayout;
  readonly axis: Axis;
  readonly vertical: boolean;
  readonly chains: ReadonlyMap<string, Set<string>>;
  readonly roomOf: (id: string) => FrameRoom;
}

export function expandGapsForSubgraphs(graph: Graph, layout: GridLayout, direction: Direction): void {
  if (graph.subgraphs.length === 0) return;

  const chains = new Map<string, Set<string>>();
  for (const id of graph.nodeOrder) chains.set(id, chainOf(graph, id));

  const axis = axisOf(direction);
  const rooms = new Map<string, FrameRoom>();
  for (const sg of everySubgraph(graph)) rooms.set(sg.id, frameRoom(sg, layout));
  const frames: Frames = { graph, layout, axis, vertical: !axis.horizontal, chains, roomOf: (id) => must(rooms.get(id)) };
  widenFlowGaps(frames);
  widenCrossGaps(frames);
}

const MARK_SHAPES = new Set([NodeShape.START_STATE, NodeShape.END_STATE, NodeShape.CHOICE_STATE]);

// The gaps between two layers along the flow, as deep as the frames that close and open between them.
function widenFlowGaps({ graph, layout, axis, vertical, chains, roomOf }: Frames): void {
  const openAlong = (id: string): number => (vertical ? roomOf(id).lid : roomOf(id).side + 2);
  const closeAlong = (id: string): number => (vertical ? roomOf(id).floor + roomOf(id).standoff : roomOf(id).side + 1);
  const approachAlong = (id: string): number => (vertical ? roomOf(id).approach : SG_APPROACH);

  const flowGroups = new Map<number, string[]>();
  for (const [id, p] of layout.placements) pushInto(flowGroups, axis.along(p), id);

  const marksOnly = (layer: number): boolean => {
    const held = flowGroups.get(layer) ?? [];
    return held.length > 0 && held.every((id) => MARK_SHAPES.has(must(graph.nodes.get(id)?.shape)));
  };
  // A run turning between two layers into frames it opens, crossing no wall of a frame that closes or stands beside.
  const turnsBetween = (first: number, second: number): boolean =>
    [...placedEdges(graph, layout)].some(({ src, tgt }) => {
      const [upper, lower] = axis.along(src) <= axis.along(tgt) ? [src, tgt] : [tgt, src];
      const inner = chains.get(lower.nodeId) ?? new Set<string>();
      const walls = [...(chains.get(upper.nodeId) ?? [])].every((sg) => inner.has(sg));
      return axis.along(upper) === first && axis.along(lower) === second && axis.across(src) !== axis.across(tgt) && walls;
    });
  const sortedFlow = [...flowGroups.keys()].sort((a, b) => a - b);

  for (let i = 0; i < sortedFlow.length - 1; i++) {
    const first = sortedFlow[i];
    const second = sortedFlow[i + 1];
    const before = new Set<string>();
    for (const id of flowGroups.get(first) ?? []) for (const sg of chains.get(id) ?? []) before.add(sg);
    const after = new Set<string>();
    for (const id of flowGroups.get(second) ?? []) for (const sg of chains.get(id) ?? []) after.add(sg);

    const borders = symmetricDifference(before, after);
    if (borders === 0) continue;
    let closing = 0;
    let closingWhole = 0;
    let approaches = 0;
    let walls = 0;
    for (const id of before) {
      if (after.has(id)) continue;
      walls += roomOf(id).side;
      closing += closeAlong(id);
      closingWhole += vertical ? closeAlong(id) : openAlong(id);
      approaches = Math.max(approaches, approachAlong(id));
    }
    const firstGap = first + 2;
    const lastGap = second - 2;
    if (firstGap > lastGap) continue;
    const served = (gap: number, atLow: boolean, atHigh: boolean): number => {
      if (!vertical || approaches > 0) return 0;
      const height = layout.rowHeights.get(gap) ?? UNSIZED_ROW;
      const labelled = layout.gapLabelRows.get(gap);
      if (labelled !== undefined && labelled.rows === height) return Math.max(0, height - TIGHT_LABEL_LANES - labelled.tall);
      const heads = layout.gapHeads.get(gap);
      if (heads === undefined || height !== heads.asked) return 0;
      return (atLow && heads.low ? 1 : 0) + (atHigh && heads.high ? 1 : 0);
    };
    const give = (gap: number, room: number): void => {
      if (vertical) layout.rowHeights.set(gap, Math.max(layout.rowHeights.get(gap) ?? UNSIZED_ROW, room));
      else layout.colWidths.set(gap, Math.max(layout.colWidths.get(gap) ?? UNSIZED_COL, room));
    };
    const add = (gap: number, room: number): void => {
      if (vertical) layout.rowHeights.set(gap, (layout.rowHeights.get(gap) ?? UNSIZED_ROW) + room);
      else layout.colWidths.set(gap, (layout.colWidths.get(gap) ?? UNSIZED_COL) + room);
    };
    let opening = 0;
    let approachOpen = 0;
    let openWalls = 0;
    for (const id of flowGroups.get(second) ?? []) {
      let depth = 0;
      let sides = 0;
      for (const sg of chains.get(id) ?? []) {
        if (!after.has(sg) || before.has(sg)) continue;
        depth += openAlong(sg);
        sides += roomOf(sg).side;
        approachOpen = Math.max(approachOpen, approachAlong(sg));
      }
      opening = Math.max(opening, depth);
      openWalls = Math.max(openWalls, sides);
    }
    approaches = Math.max(approaches, approachOpen);
    const twoWayAcross = graph.edges.some(
      (e) =>
        e.sourceIsSubgraph &&
        e.targetIsSubgraph &&
        e.hasArrowStart &&
        e.hasArrowEnd &&
        ((before.has(e.source) && !after.has(e.source) && after.has(e.target) && !before.has(e.target)) ||
          (before.has(e.target) && !after.has(e.target) && after.has(e.source) && !before.has(e.source)))
    );
    // A head landing on an opening frame from a bare node has no closing frame's standoff to carry its shaft.
    const onOpening = (id: string, isSubgraph: boolean): boolean => isSubgraph && after.has(id) && !before.has(id) && !roomOf(id).tight;
    const fromFirst = (id: string, isSubgraph: boolean): boolean => !isSubgraph && (flowGroups.get(first) ?? []).includes(id);
    const bareLanding =
      vertical &&
      closing === 0 &&
      graph.edges.some(
        (e) =>
          (e.hasArrowEnd && onOpening(e.target, e.targetIsSubgraph) && fromFirst(e.source, e.sourceIsSubgraph)) ||
          (e.hasArrowStart && onOpening(e.source, e.sourceIsSubgraph) && fromFirst(e.target, e.targetIsSubgraph))
      );
    const shaft = approaches > 0 && twoWayAcross ? 1 : 0;
    if (firstGap === lastGap) {
      const existing = (vertical ? layout.rowHeights.get(firstGap) : layout.colWidths.get(firstGap)) ?? 0;
      const carried = vertical ? 0 : SG_APPROACH + 1;
      const fed = marksOnly(first) || bareLanding ? Math.max(SG_APPROACH + 1, existing - carried) : approaches;
      // A run turning between the two layers leaves its box a row before the lane it turns on, clear of the lid.
      const runs = vertical && turnsBetween(first, second) ? Math.max(fed, TURN_CELLS - 1 - closingWhole) : fed;
      const lanes =
        approaches === 0 && !marksOnly(first) ? Math.max(existing - served(firstGap, closing > 0, opening > 0), UNSIZED_ROW) : 0;
      // A label on a run through the walls stands in free cells between them, clear of every wall it passes.
      const labelled = vertical ? 0 : walls + openWalls + (layout.gapLabelCols.get(firstGap) ?? 0);
      const spilt = vertical ? undefined : layout.labelRoom.get(firstGap);
      // Lanes counted from the gap hold a tall label's rows already; runs sized by the frame alone are given them here.
      const tall = vertical && lanes === 0 ? (layout.gapLabelRows.get(firstGap)?.tall ?? 0) : 0;
      const framed = closingWhole + opening + runs + shaft + lanes + tall;
      const beside = spilt === undefined ? 0 : Math.max(closingWhole, spilt.low) + Math.max(opening + runs - 1, spilt.high) + 1;
      give(firstGap, Math.max(framed, labelled, beside));
      continue;
    }
    add(firstGap, closing - served(firstGap, closing > 0, false));
    add(lastGap, opening + approaches - served(lastGap, false, opening > 0));
  }
}

// The gaps between two columns across the flow, as wide as the frames whose sides close and open between them.
function widenCrossGaps({ graph, layout, axis, vertical, chains, roomOf }: Frames): void {
  const openAcross = (id: string): number => (vertical ? roomOf(id).side + 2 : roomOf(id).lid);
  const closeAcross = (id: string): number => (vertical ? roomOf(id).side : roomOf(id).floor) + 1;

  const crossGroups = new Map<number, string[]>();
  for (const [id, p] of layout.placements) pushInto(crossGroups, axis.across(p), id);
  const sortedCross = [...crossGroups.keys()].sort((a, b) => a - b);

  const crossSpans = new Map<string, [number, number]>();
  for (const [id, chain] of chains) {
    const p = layout.placements.get(id);
    if (p === undefined) continue;
    const at = axis.across(p);
    for (const sg of chain) widenSpan(crossSpans, sg, at);
  }
  for (let i = 0; i < sortedCross.length - 1; i++) {
    const first = sortedCross[i];
    const second = sortedCross[i + 1];
    let closing = 0;
    let opening = 0;
    let walls = 0;
    for (const [id, span] of crossSpans) {
      if (span[1] === first) closing += closeAcross(id);
      if (span[0] === second) opening += openAcross(id);
      if (span[1] === first || span[0] === second) walls += roomOf(id).side;
    }
    if (closing + opening === 0) continue;
    let approach = 0;
    const closingHere = new Set<string>();
    for (const [sg, span] of crossSpans) if (span[1] === first) closingHere.add(sg);
    const boxedHere = (id: string): boolean => [...(chains.get(id) ?? [])].some((sg) => closingHere.has(sg));
    const openingHere = new Set<string>();
    for (const [sg, span] of crossSpans) if (span[0] === second) openingHere.add(sg);
    // A head landing on a frame's rule needs the row of its shaft as much as one landing on a box.
    const framed = (id: string, isSubgraph: boolean, frames: Set<string>): boolean => isSubgraph && frames.has(id);
    if (
      graph.edges.some(
        (e) =>
          (e.hasArrowEnd || e.hasArrowStart) &&
          ((framed(e.source, e.sourceIsSubgraph, closingHere) && framed(e.target, e.targetIsSubgraph, openingHere)) ||
            (framed(e.target, e.targetIsSubgraph, closingHere) && framed(e.source, e.sourceIsSubgraph, openingHere)))
      )
    )
      approach = SG_APPROACH;
    for (const { edge, src: source, tgt: target } of placedEdges(graph, layout)) {
      if (approach > 0) break;
      const a = axis.across(source);
      const b = axis.across(target);
      if (Math.min(a, b) <= first && Math.max(a, b) >= second && (boxedHere(edge.source) || boxedHere(edge.target))) {
        approach = SG_APPROACH;
        break;
      }
    }
    const room = closing + (opening > 0 ? opening + approach : 0);
    for (let gap = first + 2; gap <= second - 2; gap++) {
      const spilt = vertical ? layout.labelRoom.get(gap) : undefined;
      const seam =
        spilt === undefined
          ? room
          : Math.max(closing, spilt.low) +
            Math.max(opening > 0 ? opening + approach - 1 : 0, spilt.high) +
            1;
      const labelled = vertical ? walls + (layout.gapLabelCols.get(gap) ?? 0) : 0;
      if (vertical) layout.colWidths.set(gap, Math.max(layout.colWidths.get(gap) ?? UNSIZED_COL, seam, labelled));
      else layout.rowHeights.set(gap, Math.max(layout.rowHeights.get(gap) ?? UNSIZED_ROW, room));
    }
  }
}
