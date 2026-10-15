import type { GitGraph } from "./model.js";
import { Canvas } from "../../canvas/canvas.js";
import type { CharSet } from "../../canvas/model.js";
import { centredOn, displayWidth } from "../../text/width.js";
import { must } from "../../must.js";
import { GIT_BRANCH_PREFIX, GIT_COMMIT_LABEL, indexed } from "../../canvas/keys.js";
import { labelOf, markLead, putMarker, putTags as layTags, tagsText } from "./marks.js";
import { chipped, chipWidth, putChip } from "../../canvas/chip.js";
import { sortedBranches } from "./order.js";
import { slotCount, slotsOf } from "./slots.js";
import { lanesOf, wiring } from "./wiring.js";
import { rectFree } from "../../canvas/cells.js";

const MARGIN = 2;
const NAME_ROWS = 2;
const TB_ROW_GAP = 4;
const TB_MIN_COL_GAP = 10;
const TB_LABEL_ROOM = 4;
const TB_LABEL_MARGIN = 2;
const TAG_GAP = 1;
// Lanes side by side stand a blank column apart, never read as one doubled line.
const LANE_STEP = 2;

const halfOf = (text: string): number => Math.floor(displayWidth(text) / 2);

export function drawVertical(diagram: GitGraph, cs: CharSet, bottomToTop: boolean, rounded: boolean): Canvas {
  const branches = sortedBranches(diagram);
  const named = diagram.showBranches;

  let widest = 0;
  if (named) for (const name of branches) widest = Math.max(widest, chipWidth(name));
  for (const commit of diagram.commits) {
    const label = labelOf(diagram, commit);
    if (label !== "") widest = Math.max(widest, chipWidth(label));
    widest = Math.max(widest, displayWidth(tagsText(commit.tags, cs)));
  }
  const columnGap = Math.max(widest + TB_LABEL_ROOM, TB_MIN_COL_GAP);

  // The first branch stands far enough in for every word centred on it to start on the canvas.
  const firstLane = branches[0];
  let firstColumn = MARGIN;
  if (named && firstLane !== undefined) firstColumn = Math.max(firstColumn, halfOf(chipped(firstLane)));
  for (const commit of diagram.commits) {
    if (commit.branch !== firstLane) continue;
    const label = labelOf(diagram, commit);
    if (label !== "") firstColumn = Math.max(firstColumn, halfOf(chipped(label)));
    if (commit.tags.length > 0) firstColumn = Math.max(firstColumn, displayWidth(tagsText(commit.tags, cs)) + TAG_GAP + markLead(commit, cs));
  }
  const columns = new Map<string, number>();
  branches.forEach((name, i) => columns.set(name, firstColumn + i * columnGap));

  const slots = slotsOf(diagram);
  const count = slotCount(slots);
  let height: number;
  let labelRow: number;
  let rowOf: (slot: number) => number;
  if (bottomToTop) {
    labelRow = MARGIN + count * TB_ROW_GAP + TB_LABEL_MARGIN;
    height = (named ? labelRow : labelRow - TB_ROW_GAP) + NAME_ROWS + MARGIN;
    rowOf = (slot) => MARGIN + (count - 1 - slot) * TB_ROW_GAP + NAME_ROWS;
  } else {
    labelRow = MARGIN;
    const top = named ? MARGIN + NAME_ROWS : MARGIN;
    height = top + count * TB_ROW_GAP + MARGIN;
    rowOf = (slot) => top + slot * TB_ROW_GAP;
  }
  const rows = new Map(diagram.commits.map((commit) => [commit.key, rowOf(must(slots.get(commit.key)))]));

  const canvas = new Canvas(firstColumn + branches.length * columnGap + MARGIN, height);
  wiring(diagram, {
    across: columns,
    along: rows,
    forward: bottomToTop ? -1 : 1,
    lineStart: bottomToTop ? labelRow - 1 : labelRow + 1,
    cell: (along, across) => [along, across],
    lane: (from, to, index) => Math.ceil((from + to) / 2) - LANE_STEP * index,
    lanes: lanesOf(diagram, (from, to) => from + to),
  }).paint(canvas, cs, rounded);

  if (named) branches.forEach((name, i) => putChip(canvas, labelRow, centredOn(must(columns.get(name)), chipped(name)), name, indexed(GIT_BRANCH_PREFIX, i)));
  const seats = new Map(branches.map((name, i) => [name, i]));

  for (const commit of diagram.commits) {
    const row = must(rows.get(commit.key));
    const column = must(columns.get(commit.branch));
    putMarker(canvas, row, column, commit, cs, must(seats.get(commit.branch)));

    const label = labelOf(diagram, commit);
    if (label !== "") putChip(canvas, bottomToTop ? row - 1 : row + 1, centredOn(column, chipped(label)), label, GIT_COMMIT_LABEL);
    if (commit.tags.length > 0) putTags(canvas, row, bottomToTop ? row + 1 : row - 1, column - markLead(commit, cs), commit.tags, cs);
  }
  return canvas;
}

// Tags stand on the commit's row, left of the marker; a link arriving from the left sends them one row back, on
// the side the label leaves free.
function putTags(canvas: Canvas, row: number, back: number, column: number, tags: readonly string[], cs: CharSet): void {
  const width = displayWidth(tagsText(tags, cs));
  const start = column - TAG_GAP - width;
  layTags(canvas, rectFree(canvas, row, start, 1, width + TAG_GAP) ? row : back, start, tags, cs);
}
