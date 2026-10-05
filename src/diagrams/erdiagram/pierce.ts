import { rectFree } from "../../canvas/cells.js";
import { DASHED, type ERDiagram, type Block, type PinnedEnd, type PinnedEnds, type EndOffsets, type Layout } from "./model.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { lineStrokes } from "../../canvas/strokes.js";
import { must } from "../../must.js";
import { MARKER_ALONG, sideRow } from "./metrics.js";
import { bandCols, bandRows, relationshipGeometry, type RoutingPlan } from "./geometry.js";
import { drawCardMarker, weldEnd } from "./entity-box.js";
import { EDGE, NODE } from "../../canvas/keys.js";

export function planPierces(
  diagram: ERDiagram,
  blocks: Map<string, Block>,
  layout: Layout,
  offsets: EndOffsets,
  plan: RoutingPlan,
  pinned: Map<number, PinnedEnds>,
  isLR: boolean
): Map<number, PinnedEnds> | undefined {
  const clearRun = (flat: boolean, block: string, pin: PinnedEnd, row: number, col: number): boolean => {
    const at = layout.positions.get(block);
    const held = blocks.get(block);
    if (at === undefined || held === undefined) return false;
    const ex = at[0] + pin.spot.x;
    const ey = at[1] + pin.spot.y;
    const lo = flat ? Math.min(col, col < ex ? ex - 1 : ex + pin.spot.w) : Math.min(row, row < ey ? ey - 1 : ey + pin.spot.h);
    const hi = flat ? Math.max(col, col < ex ? ex - 1 : ex + pin.spot.w) : Math.max(row, row < ey ? ey - 1 : ey + pin.spot.h);
    for (const [other, spot] of held.spots) {
      if (other === pin.name) continue;
      const ox = at[0] + spot.x;
      const oy = at[1] + spot.y;
      if (flat) {
        if (row >= oy && row < oy + spot.h && ox <= hi && ox + spot.w - 1 >= lo) return false;
      } else if (col >= ox && col < ox + spot.w && oy <= hi && oy + spot.h - 1 >= lo) return false;
    }
    return true;
  };
  const flankFor = (block: string, pin: PinnedEnd, otherMid: number, reach: number): -1 | 1 | undefined => {
    const at = layout.positions.get(block);
    const held = blocks.get(block);
    const size = layout.sizes.get(block);
    if (at === undefined || held === undefined || size === undefined) return undefined;
    const [pw, ph] = size;
    const spot = pin.spot;
    const inside = (side: -1 | 1): boolean => {
      if (!isLR) {
        const row = sideRow(spot.y, spot.h);
        const from = side < 0 ? 1 : spot.x + spot.w;
        const to = side < 0 ? spot.x - 1 : pw - 2;
        return rectFree(held.panel, row, from, 1, to - from + 1);
      }
      const col = spot.x + Math.floor(spot.w / 2);
      const from = side < 0 ? 1 : spot.y + spot.h;
      const to = side < 0 ? spot.y - 1 : ph - 2;
      return rectFree(held.panel, from, col, to - from + 1, 1);
    };
    const outside = (side: -1 | 1): boolean => {
      const lane = !isLR ? (side < 0 ? at[0] - 2 : at[0] + pw + 1) : side < 0 ? at[1] - 2 : at[1] + ph + 1;
      if (lane < 1) return false;
      const seat = !isLR ? at[1] + sideRow(spot.y, spot.h) : at[0] + spot.x + Math.floor(spot.w / 2);
      const lo = Math.min(seat, reach);
      const hi = Math.max(seat, reach);
      for (const [name, box] of layout.positions) {
        if (name === block) continue;
        const [ow, oh] = must(layout.sizes.get(name));
        if (!isLR) {
          if (lane >= box[0] && lane < box[0] + ow && box[1] <= hi && box[1] + oh - 1 >= lo) return false;
        } else if (lane >= box[1] && lane < box[1] + oh && box[0] <= hi && box[0] + ow - 1 >= lo) return false;
      }
      return true;
    };
    const mid = !isLR ? at[0] + Math.floor(pw / 2) : at[1] + Math.floor(ph / 2);
    const order: Array<-1 | 1> = otherMid >= mid ? [1, -1] : [-1, 1];
    for (const side of order) if (inside(side) && outside(side)) return side;
    return undefined;
  };
  for (const [index, pin] of [...pinned]) {
    const rel = diagram.relationships[index];
    const g = relationshipGeometry(rel, index, layout, plan, offsets, isLR, pin);
    if (g === undefined) {
      pinned.delete(index);
      continue;
    }
    const flat = g.corridor === undefined ? g.horizontal : !g.horizontal;
    const la = layout.layerOf.get(rel.entity1);
    const lb = layout.layerOf.get(rel.entity2);
    const canFlank = g.corridor === undefined && la !== undefined && lb !== undefined && la !== lb;
    let reach = 0;
    if (canFlank) {
      const lane = plan.lanes.get(index) ?? 0;
      reach = !isLR
        ? bandRows(layout, Math.min(la, lb))[0] + MARKER_ALONG + 1 + lane
        : bandCols(layout, Math.min(la, lb))[0] + MARKER_ALONG + 1 + lane * 2;
    }
    const midOf = (name: string): number => {
      const box = must(layout.positions.get(name));
      const [w, h] = must(layout.sizes.get(name));
      return !isLR ? box[0] + Math.floor(w / 2) : box[1] + Math.floor(h / 2);
    };
    const keep = (end: PinnedEnd | undefined, block: string, row: number, col: number, other: string): PinnedEnd | undefined => {
      if (end === undefined) return undefined;
      if (clearRun(flat, block, end, row, col)) return end;
      if (canFlank) {
        const side = flankFor(block, end, midOf(other), reach);
        if (side !== undefined) {
          end.flank = side;
          return end;
        }
      }
      return undefined;
    };
    const one = keep(pin.one, rel.entity1, g.startRow, g.startCol, rel.entity2);
    const two = keep(pin.two, rel.entity2, g.endRow, g.endCol, rel.entity1);
    const laneAt = (block: string, side: -1 | 1): number => {
      const box = must(layout.positions.get(block));
      const [w, h] = must(layout.sizes.get(block));
      return !isLR ? (side < 0 ? box[0] - 2 : box[0] + w + 1) : side < 0 ? box[1] - 2 : box[1] + h + 1;
    };
    if (two?.flank !== undefined && (one === undefined || one.flank !== undefined))
      offsets.exit.set(index, laneAt(rel.entity2, two.flank) - midOf(rel.entity1));
    if (one?.flank !== undefined && (two === undefined || two.flank !== undefined))
      offsets.arrival.set(index, laneAt(rel.entity1, one.flank) - midOf(rel.entity2));
    if (one === undefined && two === undefined) pinned.delete(index);
    else pinned.set(index, { one, two });
  }
  return pinned.size === 0 ? undefined : pinned;
}

export function drawPierces(
  canvas: Canvas,
  diagram: ERDiagram,
  layout: Layout,
  offsets: EndOffsets,
  plan: RoutingPlan,
  pinned: Map<number, PinnedEnds>,
  isLR: boolean,
  cs: CharSet
): void {
  for (const [index, pin] of pinned) {
    const rel = diagram.relationships[index];
    const g = relationshipGeometry(rel, index, layout, plan, offsets, isLR, pin);
    if (g === undefined) continue;
    const [hChar, vChar] = lineStrokes(cs, rel.lineStyle === DASHED);
    const reaches = [
      { pin: pin.one, block: rel.entity1, card: rel.card1, row: g.startRow, col: g.startCol },
      { pin: pin.two, block: rel.entity2, card: rel.card2, row: g.endRow, col: g.endCol },
    ];
    for (const end of reaches) {
      if (end.pin === undefined) continue;
      const flat = g.corridor !== undefined || end.pin.flank !== undefined ? !g.horizontal : g.horizontal;
      const at = layout.positions.get(end.block);
      if (at === undefined) continue;
      const spot = end.pin.spot;
      const ex = at[0] + spot.x;
      const ey = at[1] + spot.y;
      if (!flat) {
        const s = end.row < ey ? 1 : -1;
        const figRow = s > 0 ? ey - 1 : ey + spot.h;
        for (let r = end.row + s; s > 0 ? r < figRow : r > figRow; r += s)
          if (!canvas.isText(r, end.col)) canvas.put(r, end.col, vChar, false, EDGE);
        drawCardMarker(canvas, end.card, figRow, end.col, s, 0, cs);
        weldEnd(canvas, cs, figRow + s, end.col, s > 0 ? cs.teeUp : cs.teeDown, end.card, NODE);
      } else {
        const s = end.col < ex ? 1 : -1;
        const figCol = s > 0 ? ex - 1 : ex + spot.w;
        for (let c = end.col + s; s > 0 ? c < figCol : c > figCol; c += s)
          if (!canvas.isText(end.row, c)) canvas.put(end.row, c, hChar, false, EDGE);
        drawCardMarker(canvas, end.card, end.row, figCol, 0, s, cs);
        weldEnd(canvas, cs, end.row, figCol + s, s > 0 ? cs.teeLeft : cs.teeRight, end.card, NODE);
      }
    }
  }
}

