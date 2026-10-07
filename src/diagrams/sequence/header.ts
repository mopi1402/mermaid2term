import { type Participant, DEFAULT_KIND } from "./model.js";
import { centredOn, displayWidth } from "../../text/width.js";
import { Canvas, DEFAULT_STYLE } from "../../canvas/canvas.js";
import { ARCS, BOX } from "../../canvas/alphabet.js";
import { SLAB_BOTTOM, SLAB_LEFT, SLAB_RIGHT, SLAB_TOP, slabRing } from "../../graph/render/slabs.js";
import { boxCells } from "../../canvas/extent.js";
import { type CharSet } from "../../canvas/model.js";
import { ACTOR_FILL, ACTOR_LABEL, ACTOR_RIM, EDGE, LABEL as STYLE_LABEL, LIFELINE as STYLE_LIFELINE, SLAB_TAIL } from "../../canvas/keys.js";
import { STYLE_ACTOR, STYLE_BAND } from "./ink.js";
import { ACTOR_HEIGHT, BOUNDARY_HEIGHT, BOX_HEIGHT, COLLECTIONS_HEIGHT, CONTROL_HEIGHT, ENTITY_HEIGHT, LINK_INSET, SYMBOL_HEIGHT, labelLines, linkRows } from "./metrics.js";
import { putCentredLines } from "../../canvas/shape-frame.js";
import { drawActor, drawBoundary, drawCollections, drawControl, drawDatabase, drawEntity, drawQueue, drawActorBox } from "./participants.js";

const STYLE_ACTOR_RIM = ACTOR_RIM;

const ACTOR_INDEX_MARK = ":";

export function stampParticipant(canvas: Canvas, index: number, top: number, height: number, cx: number, width: number): void {
  const left = Math.max(0, cx - Math.ceil(width / 2) - 1);
  const right = Math.min(canvas.width - 1, cx + Math.ceil(width / 2) + 1);
  for (let r = top; r < top + height; r++) {
    for (let c = left; c <= right; c++) {
      const key = canvas.getStyle(r, c);
      if (key === STYLE_ACTOR || key.startsWith(`${STYLE_ACTOR}@`)) {
        canvas.setStyle(r, c, `${STYLE_ACTOR}${ACTOR_INDEX_MARK}${index}${key.slice(STYLE_ACTOR.length)}`);
      }
    }
  }
}

const LIFELINE_TEES = new Set([BOX.teeDown, BOX.teeUp]);

const EDGE_TEES = new Set([BOX.teeRight, BOX.teeLeft]);

export function slabActorBoxes(canvas: Canvas, cs: CharSet, lifelineChar: string): void {
  const split = (key: string): [string, string] => {
    const seated = key.lastIndexOf(STYLE_BAND);
    return seated === -1 ? [key, ""] : [key.slice(0, seated), key.slice(seated)];
  };
  const isActor = (key: string): boolean =>
    key === STYLE_ACTOR || key.startsWith(`${STYLE_ACTOR}@`) || key.startsWith(`${STYLE_ACTOR}${ACTOR_INDEX_MARK}`);
  const bare = (key: string): boolean => !key.includes("@");
  const insideAt = (r: number, c: number): boolean => {
    const [key] = split(canvas.getStyle(r, c));
    return isActor(key) && !bare(key);
  };
  slabRing(canvas, boxCells({ top: 0, bottom: canvas.height - 1, left: 0, right: canvas.width - 1 }), {
    slabOf: (r, c) => {
      const [key, band] = split(canvas.getStyle(r, c));
      return !isActor(key) || !bare(key) || canvas.isText(r, c) ? undefined : `${key}${SLAB_TAIL}${band}`;
    },
    settle: (r, c, ch) => {
      const [, band] = split(canvas.getStyle(r, c));
      if (LIFELINE_TEES.has(ch) || EDGE_TEES.has(ch)) {
        const onLifeline = LIFELINE_TEES.has(ch);
        canvas.recast(r, c, onLifeline ? lifelineChar : cs.horizontal);
        canvas.setStyle(r, c, (onLifeline ? STYLE_LIFELINE : EDGE) + band);
        return true;
      }
      if (!ARCS.has(ch)) return false;
      canvas.recast(r, c, " ");
      canvas.setStyle(r, c, DEFAULT_STYLE + band);
      return true;
    },
    across: (r, c) => (insideAt(r + 1, c) ? SLAB_TOP : insideAt(r - 1, c) ? SLAB_BOTTOM : undefined),
    down: (r, c) => (insideAt(r, c + 1) ? SLAB_LEFT : insideAt(r, c - 1) ? SLAB_RIGHT : undefined),
  });
}

export function drawParticipantHeader(
  canvas: Canvas,
  cx: number,
  boxWidth: number,
  top: number,
  headerHeight: number,
  participant: Participant,
  cs: CharSet,
  borderless = false,
  padless = false
): readonly [number, number] | undefined {
  const { kind, label } = participant;
  const links = linkRows(participant);
  const broken = Math.max(0, labelLines(label).length - 1) + links;
  const floor = top + headerHeight;
  if (kind !== DEFAULT_KIND) {
    participant.links.forEach((link, at) => {
      const row = floor - links + at;
      const col = centredOn(cx, link.label);
      canvas.putText(row, col, link.label, STYLE_LABEL);
      if (link.url !== undefined) canvas.linkLabel(row, col, displayWidth(link.label), 1, link.url);
    });
  }
  const symbolY = top + (headerHeight - SYMBOL_HEIGHT - broken);

  if (kind === "actor") drawActor(canvas, cx, top + (headerHeight - ACTOR_HEIGHT - broken), label, cs);
  else if (kind === "database") drawDatabase(canvas, cx, symbolY, label, cs);
  else if (kind === "queue") drawQueue(canvas, cx, symbolY, label, cs);
  else if (kind === "boundary")
    drawBoundary(canvas, cx, top + (headerHeight - BOUNDARY_HEIGHT - broken), label, cs);
  else if (kind === "control")
    drawControl(canvas, cx, top + (headerHeight - CONTROL_HEIGHT - broken), label, cs);
  else if (kind === "entity")
    drawEntity(canvas, cx, top + (headerHeight - ENTITY_HEIGHT - broken), label, cs);
  else if (kind === "collections")
    drawCollections(canvas, cx, top + (headerHeight - COLLECTIONS_HEIGHT - broken), boxWidth, label, cs);
  else {
    const boxY = top + (headerHeight - BOX_HEIGHT - broken);
    const boxX = cx - Math.floor(boxWidth / 2);
    if (links === 0) {
      drawActorBox(canvas, boxX, boxY, boxWidth, BOX_HEIGHT + broken, label, cs, true, padless);
      return [boxY, boxY + BOX_HEIGHT + broken - 1];
    }
    const boxHeight = BOX_HEIGHT + broken;
    if (borderless) {
      for (let r = boxY; r < boxY + boxHeight; r++) for (let c = boxX; c < boxX + boxWidth; c++) canvas.setStyle(r, c, ACTOR_FILL);
    } else drawActorBox(canvas, boxX, boxY, boxWidth, boxHeight, "", cs, true, padless);
    putCentredLines(canvas, boxY + 1, boxX, boxWidth, labelLines(label), ACTOR_LABEL);
    const rule = boxY + 1 + labelLines(label).length;
    // The rule carries the box's fill like every other interior cell: a stroke on the bare page would cut a
    // white band across the participant.
    canvas.putRow(rule, boxX + 1, boxX + boxWidth - 1, cs.horizontal, false, STYLE_ACTOR_RIM);
    participant.links.forEach((link, at) => {
      const row = rule + 1 + at;
      canvas.putText(row, boxX + 1 + LINK_INSET, link.label, ACTOR_LABEL);
      if (link.url !== undefined) canvas.linkLabel(row, boxX + 1 + LINK_INSET, displayWidth(link.label), 1, link.url);
    });
    return [boxY, boxY + boxHeight - 1];
  }
  return undefined;
}
