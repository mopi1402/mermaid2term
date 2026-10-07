import { rectFree } from "../../canvas/cells.js";
import type { Participant, SequenceDiagram } from "./model.js";

import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";

import { ACTIVE_INDEXED, ACTIVE_MARK_INDEXED, LABEL, LIFELINE as STYLE_LIFELINE, indexed } from "../../canvas/keys.js";
import { titledAbove } from "../@common/titled.js";
import { BOTTOM_MARGIN, BOX_AIR, BOX_PAD, kindAnchor, labelLines, MIN_GAP, nameHeight, STACK_MARK } from "./metrics.js";
import { createAt, flattenEvents, kindOf, messageAt } from "./events.js";
import { messagePad } from "./sizes.js";
import { computeLayout } from "./layout.js";
import { drawParticipantHeader, slabActorBoxes, stampParticipant } from "./header.js";
import { bandCellOf, bandGlyph, computeActivationRanges } from "./bands.js";
import { STYLE_ACTIVE, STYLE_FRAME } from "./ink.js";
import { frameBounds, rectFill } from "./blocks.js";
import { RECT } from "./patterns.js";
import { asksToFold, foldForBudget } from "./fold.js";
import { drawBox } from "./draw-blocks.js";
import { layBand } from "../../canvas/band.js";
import { drawEvents, type Scene } from "./walk.js";

// A `rect` block's ground, laid once every event is drawn.
interface Ground {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly fill: string;
}

// A participant drawn at the foot carries no links: its menu belongs to the head.
const footed = (participant: Participant): Participant => ({ ...participant, links: [] });

// Where the rows the drawing is laid on stand: each message's arrow, and the lifelines' first and last.
interface Rows {
  readonly arrowRowOf: (index: number) => number;
  readonly footerTop: number;
  readonly lifelineStart: number;
  readonly lifelineEnd: number;
}

function rowsOf(diagram: SequenceDiagram, flat: Scene["flat"], layout: Scene["layout"]): Rows {
  const { destroysAt, createsAt } = layout.bindings;
  const arrowRowOf = (index: number): number => {
    const message = messageAt(flat, index);
    const pad = messagePad(diagram, index, destroysAt, createsAt);
    return (layout.rowOffsets[index]) + Math.max(0, labelLines(message.label).length - 1) + pad.push;
  };
  return {
    arrowRowOf,
    footerTop: layout.height - BOTTOM_MARGIN + (layout.boxFrames.length > 0 ? 1 : 0),
    lifelineStart: layout.headerTop + layout.headerHeight,
    lifelineEnd: layout.height - BOTTOM_MARGIN - 1 - (layout.boxFrames.length > 0 ? BOX_AIR : 0),
  };
}

// The activation band under each lifeline cell, read by the cell's column.
function bandsOf(diagram: SequenceDiagram, flat: Scene["flat"], layout: Scene["layout"], arrowRowOf: (index: number) => number): Scene["bandOf"] {
  const { rowOffsets, colCenters } = layout;
  const activationRowOf = (index: number): number => {
    for (let before = index - 1; before >= 0; before--) {
      const event = flat[before];
      if (event.type === "activate" || event.type === "create") continue;
      if (event.type === "message") return arrowRowOf(before);
      break;
    }
    return Math.max(0, (rowOffsets[index]) - 1);
  };

  const ranges = computeActivationRanges(
    flat,
    activationRowOf,
    rowOffsets.length === 0 ? 0 : Math.max(...rowOffsets) + 1
  );

  const bandColumns = new Map<number, string>();
  diagram.participants.forEach((participant, i) => bandColumns.set(colCenters[i], participant.id));
  return (row, col) => {
    const id = bandColumns.get(col);
    if (id === undefined) return undefined;
    return bandCellOf(ranges.get(id) ?? [], row);
  };
}

// The row each destroyed participant's lifeline stops on, and the row each created one's starts on.
interface LifeSpans {
  readonly destroyed: ReadonlyMap<string, number>;
  readonly born: ReadonlyMap<string, number>;
}

function lifeSpans(scene: Scene, { arrowRowOf }: Rows): LifeSpans {
  const { diagram, flat, layout } = scene;
  const { boundDestroys, boundCreates } = layout.bindings;
  const destroyed = new Map<string, number>();
  flat.forEach((event, index) => {
    if (event.type !== "destroy" || destroyed.has(event.participant)) return;
    const bound = boundDestroys.get(index);
    if (bound === undefined) {
      destroyed.set(event.participant, layout.rowOffsets[index]);
      return;
    }
    destroyed.set(event.participant, arrowRowOf(bound) - 1);
  });

  const born = new Map<string, number>();
  for (const [index, bound] of boundCreates) {
    const id = createAt(flat, index).participant;
    if (born.has(id)) continue;
    born.set(id, arrowRowOf(bound) + kindAnchor(kindOf(diagram, id)) + 1);
  }
  return { destroyed, born };
}

function drawLifelines(scene: Scene, rows: Rows, spans: LifeSpans, lifelineChar: string, mirrorActors: boolean): void {
  const { canvas, cs, diagram, layout, bandOf } = scene;
  const { footerTop, lifelineStart, lifelineEnd } = rows;
  const { destroyed, born } = spans;
  diagram.participants.forEach((participant, i) => {
    const cx = layout.colCenters[i];
    const standsAtFoot = mirrorActors && !destroyed.has(participant.id);
    const footBoxTop = footerTop + layout.headerHeight - nameHeight(footed(participant));
    const end = destroyed.get(participant.id) ?? (standsAtFoot ? footBoxTop : lifelineEnd + 1);
    for (let r = born.get(participant.id) ?? lifelineStart; r < Math.min(end, standsAtFoot ? footBoxTop : lifelineEnd + 1); r++) {
      const cell = bandOf(r, cx);
      if (cell === undefined) canvas.put(r, cx, lifelineChar, false, STYLE_LIFELINE);
      else canvas.put(r, cx, bandGlyph(cell, "none", cs), false, STYLE_ACTIVE);
    }
  });
}

// Every block's dotted walls down its sides; a `rect`'s ground is handed back instead, to be laid last.
function drawBlockWalls(scene: Scene): Ground[] {
  const { canvas, cs, flat, layout, frameAt } = scene;
  const { rowOffsets } = layout;
  const frames: Array<[number, number, number, boolean]> = [];
  const grounds: Ground[] = [];
  flat.forEach((event, index) => {
    if (event.type === "blockStart") {
      const [left, right] = frameAt(index);
      frames.push([left, right, rowOffsets[index], event.block.kind === RECT]);
      return;
    }
    if (event.type !== "blockEnd") return;
    const frame = frames.pop();
    if (frame === undefined) return;
    const [left, right, start, ground] = frame;
    if (ground) {
      const fill = rectFill(event.block.label);
      const top = Math.max(0, start - 1);
      const bottom = (rowOffsets[index]) - 2;
      if (fill !== undefined && bottom >= top) grounds.push({ left, right, top, bottom, fill });
      return;
    }
    canvas.putColumn(left, start + 1, rowOffsets[index], cs.lineDottedV, false, STYLE_FRAME);
    if (right < canvas.width) canvas.putColumn(right, start + 1, rowOffsets[index], cs.lineDottedV, false, STYLE_FRAME);
  });
  return grounds;
}

// The depth of a stacked activation, written left of the bar where it first shows and the cells there are blank.
function markStacks(scene: Scene, { lifelineStart, lifelineEnd }: Rows): void {
  const { canvas, cs, diagram, layout, bandOf } = scene;
  const fillGlyph = cs.bandFill;
  diagram.participants.forEach((_, i) => {
    const cx = layout.colCenters[i];
    let shown = -1;
    for (let r = lifelineStart; r <= lifelineEnd; r++) {
      const cell = bandOf(r, cx);
      if (cell === undefined || cell.extra === 0) {
        shown = -1;
        continue;
      }
      if (cell.extra === shown) continue;
      if (canvas.get(r, cx) !== fillGlyph) continue;
      const count = String(cell.extra);
      const at = cx - count.length + 1;
      if (at < 1) continue;
      if (!rectFree(canvas, r, at - 1, 1, cx - at + 1)) continue;
      canvas.put(r, at - 1, STACK_MARK, false, indexed(ACTIVE_MARK_INDEXED, i));
      canvas.putText(r, at, count, indexed(ACTIVE_MARK_INDEXED, i));
      shown = cell.extra;
    }
  });
}

// Each participant's head, at the top, or at the foot where the actors are mirrored.
function drawHeads(scene: Scene, top: number, skip: Pick<ReadonlySet<string>, "has">, foot: boolean): void {
  const { canvas, cs, diagram, layout, slabbed, padless } = scene;
  const { colCenters, boxWidths, headerHeight } = layout;
  diagram.participants.forEach((participant, i) => {
    if (skip.has(participant.id)) return;
    drawParticipantHeader(canvas, colCenters[i], boxWidths[i], top, headerHeight, foot ? footed(participant) : participant, cs, slabbed, padless);
    stampParticipant(canvas, i, top, headerHeight, colCenters[i], boxWidths[i]);
  });
}

export function renderSequence(
  diagram: SequenceDiagram,
  cs: CharSet = UNICODE,
  paddingX = BOX_PAD,
  gap = MIN_GAP,
  foldBudget?: number,
  borderless = false,
  mirrorActors = false,
  heavyLifeline = false,
  actorsFilled = false,
  padless = false,
  budget?: number,
  rounded = true
): Canvas {
  const slabbed = borderless && actorsFilled;
  const lifelineChar = heavyLifeline ? cs.lifelineHeavy : cs.vertical;
  const flat = flattenEvents(diagram.events);
  // A `wrap:` or `nowrap:` prefix has folding to settle even when no width was asked for, mermaid folding a
  // flagged label at its own fixed `conf.width` whatever the page is wide.
  if (foldBudget !== undefined || flat.some(asksToFold)) foldForBudget(diagram, flat, paddingX, gap, foldBudget);
  const layout = computeLayout(diagram, flat, paddingX, gap, true, borderless || padless, padless);
  if (layout.width === 0) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);

  const { colCenters, headerHeight, headerTop, blockFrames } = layout;
  const frameAt = (index: number): [number, number] =>
    blockFrames.get(index) ?? frameBounds(colCenters, 0);
  const rows = rowsOf(diagram, flat, layout);
  const canvas = new Canvas(layout.width, mirrorActors ? rows.footerTop + headerHeight : layout.height);
  const { arrowRowOf } = rows;
  const bandOf = bandsOf(diagram, flat, layout, arrowRowOf);
  const scene: Scene = { canvas, cs, diagram, flat, layout, frameAt, arrowRowOf, bandOf, borderless, slabbed, padless, rounded };

  drawHeads(scene, headerTop, layout.bindings.created, false);
  const spans = lifeSpans(scene, rows);
  drawLifelines(scene, rows, spans, lifelineChar, mirrorActors);
  const grounds = drawBlockWalls(scene);
  drawEvents(scene);
  markStacks(scene, rows);

  // Seated BEFORE the participant boxes: mermaid lowers a `box` under the `rect` it draws (`drawBackgroundRect`
  // lowers the ground, then `drawBox` lowers the box under it), so a ground covers the walls it runs across while
  // the lifelines, drawn over both, keep their cells.
  // mermaid seats each bar on its participant's index, as it seats the participant's own box.
  colCenters.forEach((cx, i) => {
    for (let r = 0; r < canvas.height; r++) if (canvas.getStyle(r, cx) === STYLE_ACTIVE) canvas.setStyle(r, cx, indexed(ACTIVE_INDEXED, i));
  });

  grounds.sort((one, other) => one.top - other.top);
  for (const ground of grounds) layBand(canvas, ground.top, ground.bottom, ground.left, ground.right, ground.fill);

  for (const frame of layout.boxFrames) drawBox(canvas, frame, layout, cs, padless);

  if (mirrorActors) drawHeads(scene, rows.footerTop, spans.destroyed, true);
  if (slabbed) slabActorBoxes(canvas, cs, lifelineChar);
  return titledAbove(canvas, diagram.title, { key: LABEL, left: undefined, budget });
}
