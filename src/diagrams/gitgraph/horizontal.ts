import type { Commit, GitGraph } from "./model.js";
import { Canvas } from "../../canvas/canvas.js";
import type { CharSet } from "../../canvas/model.js";
import { centredOn, centredOnSpan, displayWidth } from "../../text/width.js";
import { must } from "../../must.js";
import { GIT_BRANCH_PREFIX, GIT_COMMIT_LABEL, indexed } from "../../canvas/keys.js";
import { labelOf, putMarker, putTags, tagsText } from "./marks.js";
import { chipWidth, putChip } from "../../canvas/chip.js";
import { sortedBranches } from "./order.js";
import { slotCount, slotsOf } from "./slots.js";
import { TRAIL, lanesOf, wiring } from "./wiring.js";

const MIN_COMMIT_GAP = 6;
const BRANCH_GAP = 2;
const MARGIN = 2;
const LABEL_PAD = 2;
const NAME_GAP = 2;
const ROW_HEIGHT = BRANCH_GAP + 1;
const LANE_RISE = 2;

function footprint(diagram: GitGraph, commit: Commit, cs: CharSet): number {
  const label = labelOf(diagram, commit);
  let width = label === "" ? 0 : chipWidth(label);
  if (commit.tags.length > 0) width = Math.max(width, displayWidth(tagsText(commit.tags, cs)));
  return Math.floor((width + 1) / 2);
}

// Each step as wide as its widest label, and far enough from the one before for both to stand clear.
function stepColumns(diagram: GitGraph, slots: ReadonlyMap<string, number>, leftOffset: number, cs: CharSet): { columns: number[]; reach: number } {
  const feet: number[] = new Array<number>(slotCount(slots)).fill(0);
  for (const commit of diagram.commits) {
    const slot = must(slots.get(commit.key));
    feet[slot] = Math.max(feet[slot], footprint(diagram, commit, cs));
  }
  const columns: number[] = [];
  feet.forEach((foot, i) => {
    columns.push(i === 0 ? leftOffset + foot : columns[i - 1] + Math.max(MIN_COMMIT_GAP, feet[i - 1] + LABEL_PAD + foot));
  });
  return { columns, reach: (columns[columns.length - 1] ?? leftOffset) + (feet[feet.length - 1] ?? 0) };
}

export function drawHorizontal(diagram: GitGraph, cs: CharSet, rounded: boolean): Canvas {
  const branches = sortedBranches(diagram);
  // An arrow sent round runs two rows above the lower of its branches, which then stands a row further down for each
  // lane there: the lane and the branch line under it never run side by side.
  const seat = new Map(branches.map((name, i) => [name, i]));
  const seatOf = (branch: string): number => must(seat.get(branch));
  const lanes = lanesOf(diagram, Math.max);
  const aired = new Map([...lanes.values()].map((lane) => [lane.room, lane.count]));
  const rows = new Map<string, number>();
  let next = MARGIN;
  branches.forEach((name, i) => {
    next += aired.get(i) ?? 0;
    rows.set(name, next);
    next += ROW_HEIGHT;
  });

  const labelWidth = diagram.showBranches ? Math.max(0, ...branches.map(chipWidth)) : 0;
  const leftOffset = diagram.showBranches ? MARGIN + labelWidth + NAME_GAP : MARGIN;
  const slots = slotsOf(diagram);
  const { columns: steps, reach } = stepColumns(diagram, slots, leftOffset, cs);
  const columns = new Map(diagram.commits.map((commit) => [commit.key, must(steps[must(slots.get(commit.key))])]));

  const canvas = new Canvas(Math.max(reach, (steps[steps.length - 1] ?? leftOffset) + TRAIL) + MARGIN + 1, next + MARGIN);
  wiring(diagram, {
    across: rows,
    along: columns,
    forward: 1,
    lineStart: MARGIN + labelWidth + 1,
    cell: (along, across) => [across, along],
    lane: (from, to, index) => Math.max(from, to) - LANE_RISE - index,
    lanes,
  }).paint(canvas, cs, rounded);

  // Each name set right against the start of its line, as mermaid's label box at `-bbox.width - 4`.
  if (diagram.showBranches) {
    branches.forEach((name, i) => putChip(canvas, must(rows.get(name)), MARGIN + labelWidth - chipWidth(name), name, indexed(GIT_BRANCH_PREFIX, i)));
  }

  for (const commit of diagram.commits) {
    const column = must(columns.get(commit.key));
    const row = must(rows.get(commit.branch));
    putMarker(canvas, row, column, commit, cs, seatOf(commit.branch));
    const label = labelOf(diagram, commit);
    if (label !== "") putChip(canvas, row + 1, centredOnSpan(column, chipWidth(label)), label, GIT_COMMIT_LABEL);
    if (commit.tags.length > 0) putTags(canvas, row - 1, centredOn(column, tagsText(commit.tags, cs)), commit.tags, cs);
  }
  return canvas;
}
