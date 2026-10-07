import { type Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";

import type { SequenceDiagram, Layout } from "./model.js";
import { type FlatEvent, kindOf } from "./events.js";
import { type BandCell } from "./bands.js";
import { BOX_HEIGHT, kindAnchor, medallion, MEDALLION_COLS, nameHeight, participantIndex } from "./metrics.js";
import { STYLE_SIGNAL as STYLE_ARROW } from "./ink.js";
import { markReach } from "./sizes.js";
import { drawParticipantHeader, stampParticipant } from "./header.js";
import { drawActorBox } from "./participants.js";
import { tightenFrame } from "../../canvas/fit-frame.js";
import { STYLE_ACTOR } from "./ink.js";
import { DEFAULT_KIND } from "./model.js";
import { drawNote } from "./notes.js";
import { RECT } from "./patterns.js";
import { drawBlockEnd, drawBlockSection, drawBlockStart } from "./draw-blocks.js";
import { drawMessage, drawSelfMessage } from "./messages.js";

export interface Scene {
  canvas: Canvas;
  cs: CharSet;
  diagram: SequenceDiagram;
  flat: FlatEvent[];
  layout: Layout;
  frameAt: (index: number) => [number, number];
  arrowRowOf: (index: number) => number;
  bandOf: (row: number, col: number) => BandCell | undefined;
  borderless: boolean;
  slabbed: boolean;
  padless: boolean;
  rounded: boolean;
}

export function drawEvents(scene: Scene): void {
  const { canvas, cs, diagram, flat, layout } = scene;
  const { boundDestroys, destroysAt, createsAt } = layout.bindings;
  const { frameAt, arrowRowOf, bandOf, borderless, padless } = scene;
  const { colCenters, boxWidths, rowOffsets } = layout;
  // mermaid's own three running values (`sequenceRenderer.ts`): the count, the step, and whether the disc shows.
  // A bare `autonumber` keeps the count where it stands, its `start || sequenceIndex` reading a zero as no value.
  let counter = 1;
  let step = 1;
  let numbering = false;
  flat.forEach((event, index) => {
    const row = rowOffsets[index];

    switch (event.type) {
      case "autonumber":
        if (event.start !== undefined && event.start !== 0) counter = event.start;
        if (event.step !== undefined && event.step !== 0) step = event.step;
        numbering = event.visible;
        return;
      case "activate":
        return;
      case "create":
        return;
      case "destroy": {
        if (boundDestroys.has(index)) return;
        const at = participantIndex(diagram, event.participant);
        if (at < 0) return;
        const cx = colCenters[at];
        const w = boxWidths[at];
        drawActorBox(canvas, cx - Math.floor(w / 2), row, w, BOX_HEIGHT,
          diagram.participants[at].label, cs, true, padless);
        stampParticipant(canvas, at, row, BOX_HEIGHT, cx, w);
        return;
      }
      case "note":
        drawNote(canvas, event, row - 1, colCenters, diagram, cs, borderless, padless);
        return;
      case "blockStart":
        if (event.block.kind !== RECT) drawBlockStart(canvas, event, row, frameAt(index), cs);
        return;
      case "blockSection":
        drawBlockSection(canvas, event, row, frameAt(index), cs);
        return;
      case "blockEnd":
        if (event.block.kind !== RECT) drawBlockEnd(canvas, row, frameAt(index), cs);
        return;
      case "message": {
        // Spent before anything can return: every message moves the count on, drawn with a disc or without one.
        const number = numbering ? counter : undefined;
        counter = Math.round((counter + step) * 100) / 100;
        const label = event.label;
        const wear = (col: number, at: number, toward: number, dotted: boolean): void => {
          const disc = number === undefined ? undefined : medallion(cs, number);
          if (disc === undefined) return;
          const cells = [...disc];
          const span = cells.length * MEDALLION_COLS;
          const lastAt = (end: number): number => end - (cells.length - 1) * MEDALLION_COLS;
          // Each disc keeps the cell on its right, the side its glyph overflows into: the run is anchored by the
          // one cell that is not the drawing's to give, the lifeline it rides or the connection dot beside it.
          const from = dotted
            ? toward > 0 ? col - span : col + 1
            : toward > 0 ? col : lastAt(col);
          // The kept cell is left EMPTY and nothing is ever drawn into it: a glyph there is what a terminal
          // reading these discs narrow shrinks them against, the number coming out small and never bold.
          cells.forEach((ch, i) => {
            canvas.put(at, from + i * MEDALLION_COLS, ch, false, STYLE_ARROW);
            canvas.clearChar(at, from + i * MEDALLION_COLS + 1);
          });
          if (!dotted && event.arrowType === "bidirectional") {
            canvas.put(at, toward > 0 ? from + span : from - 1, toward > 0 ? cs.arrowLeft : cs.arrowRight, false, STYLE_ARROW);
          }
        };
        const source = participantIndex(diagram, event.source);
        const target = participantIndex(diagram, event.target);
        if (source < 0 || target < 0) return;
        const arrowRow = arrowRowOf(index);
        if (source === target) {
          drawSelfMessage(canvas, colCenters[source], arrowRow, event, label, cs, bandOf, scene.rounded);
          wear(colCenters[source], arrowRow, 1, event.dotSource === true);
          return;
        }
        let sourceCol = colCenters[source];
        let targetCol = colCenters[target];
        const dying: Array<[number, number]> = [];
        // Under padless a created or destroyed box is drawn first and the message seated on its wall, which the
        // frame then tightens past, as every padless head meets its box.
        const seated: Array<readonly [number, number, number, number]> = [];
        for (const pid of destroysAt.get(index) ?? []) {
          const at = participantIndex(diagram, pid);
          if (at !== source && at !== target) continue;
          const cx = colCenters[at];
          const w = boxWidths[at];
          const boxLeft = cx - Math.floor(w / 2);
          const other = colCenters[at === source ? target : source];
          const headed = event.arrowType === "bidirectional" || (event.reversed === true ? at === source : at === target);
          const walled = padless && headed && event.arrowType !== "open";
          const inset = walled ? 0 : 1;
          const edge = other < cx ? boxLeft - inset : boxLeft + w - 1 + inset;
          if (at === source) sourceCol = edge;
          else targetCol = edge;
          if (!walled) dying.push([at, boxLeft]);
          else {
            drawDying(scene, at, boxLeft, arrowRow);
            seated.push([arrowRow - 1, arrowRow - 2 + BOX_HEIGHT, boxLeft, boxLeft + w - 1]);
          }
        }
        const arriving: number[] = [];
        for (const pid of createsAt.get(index) ?? []) {
          const at = participantIndex(diagram, pid);
          if (at !== source && at !== target) continue;
          const cx = colCenters[at];
          const [reachLeft, reachRight] = markReach(kindOf(diagram, pid), boxWidths[at]);
          const other = colCenters[at === source ? target : source];
          const headed = event.reversed === true ? at === source : at === target;
          const walled = padless && headed && diagram.participants[at].kind === DEFAULT_KIND;
          const rows = walled ? drawArriving(scene, at, arrowRow) : undefined;
          const inset = rows === undefined ? 1 : 0;
          const edge = other < cx ? cx - reachLeft - inset : cx + reachRight + inset;
          if (at === source) sourceCol = edge;
          else targetCol = edge;
          if (rows === undefined) arriving.push(at);
          else seated.push([rows[0], rows[1], cx - reachLeft, cx + reachRight]);
        }
        drawMessage(canvas, sourceCol, targetCol, arrowRow, event, label, cs, bandOf);
        for (const [top, bottom, left, right] of seated) tightenFrame(canvas, top, bottom, left, right, STYLE_ACTOR, false);
        const worn = event.reversed === true ? targetCol : sourceCol;
        const fromSource = worn === sourceCol;
        wear(
          worn,
          arrowRow,
          fromSource ? Math.sign(targetCol - sourceCol) : Math.sign(sourceCol - targetCol),
          fromSource ? event.dotSource === true : event.dotTarget === true
        );
        for (const [at, boxLeft] of dying) drawDying(scene, at, boxLeft, arrowRow);
        for (const at of arriving) drawArriving(scene, at, arrowRow);
        return;
      }
      default:
        return;
    }
  });
}

// A destroyed participant's foot box, remounted on the message that destroys it.
function drawDying(scene: Scene, at: number, boxLeft: number, arrowRow: number): void {
  const { canvas, cs, diagram, layout, padless } = scene;
  const width = layout.boxWidths[at];
  drawActorBox(canvas, boxLeft, arrowRow - 1, width, BOX_HEIGHT, diagram.participants[at].label, cs, true, padless);
  stampParticipant(canvas, at, arrowRow - 1, BOX_HEIGHT, boxLeft + Math.floor(width / 2), width);
}

// A created participant's header, standing where the message bringing it in arrives; the rows of its frame when it
// is a box.
function drawArriving(scene: Scene, at: number, arrowRow: number): readonly [number, number] | undefined {
  const { canvas, cs, diagram, layout, slabbed, padless } = scene;
  const participant = diagram.participants[at];
  const height = nameHeight(participant);
  const top = arrowRow + kindAnchor(participant.kind) - height + 1;
  const rows = drawParticipantHeader(canvas, layout.colCenters[at], layout.boxWidths[at], top, height, participant, cs, slabbed, padless);
  stampParticipant(canvas, at, top, height, layout.colCenters[at], layout.boxWidths[at]);
  return rows;
}
