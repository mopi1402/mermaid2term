import { DEFAULT_GAP } from "../../options.js";
import {
  MD_PARENT,
  type Cardinality,
  type Entity,
} from "./model.js";
import { centredOffset, displayWidth } from "../../text/width.js";
import { SPACE } from "../../text/chars.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet, type Figure } from "../../canvas/model.js";
import {
  EDGE,
  LABEL,
  NODE,
  NODE_FAINT,
  ARROW,
  PLAIN_LABEL,
} from "../../canvas/keys.js";
import { writeCentred, writeRich } from "../../canvas/rich.js";
import { widestShown } from "../../source/markdown.js";
import { attributeColumns, attributeRows, entityTexts, nameRows } from "./attributes.js";
import { FLOOR_STEP, MIN_BOX_WIDTH, PAD, TYPE_PIPE } from "./metrics.js";
import { dividerRow, frame } from "../../canvas/shape-frame.js";
import { cornersOf } from "../../canvas/corners.js";

const CARD_ZERO = "o";

const CARD_MANY = "{}";

export const isMany = (card: Cardinality): boolean => [...card].some((ch) => CARD_MANY.includes(ch));

// Cuts `tee` into the wall an end lands on, three wide for a "many" end. With `ruleAware`, on the row of the name's
// rule the relation keeps the wall and the rule stops short of it.
export function weldEnd(canvas: Canvas, cs: CharSet, row: number, col: number, tee: string, card: Cardinality, tint: string, ruleAware = false): void {
  const ruleTee = tee === cs.teeRight ? cs.teeLeft : tee === cs.teeLeft ? cs.teeRight : tee;
  const vertical = tee === cs.teeUp || tee === cs.teeDown;
  for (const step of isMany(card) ? [-1, 0, 1] : [0]) {
    const r = vertical ? row : row + step;
    const c = vertical ? col + step : col;
    if (step !== 0 && canvas.get(r, c) !== (vertical ? cs.horizontal : cs.vertical)) continue;
    canvas.put(r, c, tee, !ruleAware || canvas.get(r, c) !== ruleTee, tint);
  }
}

export function drawCardMarker(canvas: Canvas, card: Cardinality, row: number, col: number, dr: number, dc: number, cs: CharSet): void {
  // No marker: the line runs on into the wall, a cell left bare taking the line's own glyph from beside it.
  if (card === MD_PARENT) {
    if (canvas.get(row, col) === SPACE) canvas.put(row, col, canvas.get(row - dr, col - dc), false, EDGE);
    return;
  }
  const many = isMany(card);
  const zero = [...card].includes(CARD_ZERO);
  const vertical = dr !== 0;
  let figure: Figure;
  if (vertical) {
    const table = cs.cardDown;
    const side = dr > 0 ? "down" : "up";
    figure = many ? (zero ? table.zeroMany : table.oneMany)[side] : zero ? table.zeroOne : table.one;
  } else {
    const table = cs.cardAcross;
    const side = dc > 0 ? "right" : "left";
    figure = many ? (zero ? table.zeroMany : table.oneMany)[side] : zero ? table.zeroOne : table.one;
  }
  const [a, b, c] = figure;
  if (vertical) {
    canvas.put(row, col - 1, a, false, ARROW);
    canvas.put(row, col, b, false, ARROW);
    canvas.put(row, col + 1, c, false, ARROW);
  } else {
    if (a !== "") canvas.put(row - 1, col, a, false, ARROW);
    canvas.put(row, col, b, false, ARROW);
    if (c !== "") canvas.put(row + 1, col, c, false, ARROW);
  }
}

export function boxSize(entity: Entity, paddingX: number, gap: number, airy: boolean): [number, number] {
  const rows = entityTexts(entity);
  const widest = widestShown(rows);
  const floor = paddingX >= PAD && gap > 1 ? Math.max(0, MIN_BOX_WIDTH - (DEFAULT_GAP - Math.min(gap, DEFAULT_GAP)) * FLOOR_STEP) : 0;
  const width = Math.max(widest + Math.max(paddingX, 1) * 2, floor);

  const names = nameRows(entity).length;
  let height = 2 + names;
  if (entity.attributes.length > 0) height += 1 + rows.length - names;
  else if (airy) height += 1;
  return [width, height];
}

export function drawEntityBox(
  canvas: Canvas,
  x: number,
  y: number,
  entity: Entity,
  cs: CharSet,
  paddingX: number,
  gap: number,
  airy: boolean,
  size?: [number, number]
): void {
  const [width, height] = size ?? boxSize(entity, paddingX, gap, airy);

  frame(canvas, x, y, width, height, cs, NODE, cornersOf(cs, false));

  const names = nameRows(entity);
  let row = entity.attributes.length === 0 ? y + centredOffset(height, names.length) : y + 1;
  for (const name of names) {
    writeCentred(canvas, row, x, width, name, LABEL);
    row += 1;
  }

  if (entity.attributes.length === 0) return;

  dividerRow(canvas, row, x, width, NODE, [cs.teeRight, cs.teeLeft], cs.horizontal);
  row += 1;

  const columns = attributeColumns(entity);
  for (const cells of entity.attributes.flatMap(attributeRows)) {
    let at = x + Math.max(paddingX, 1);
    for (const [order, [cell, cellWidth]] of columns.entries()) {
      if (order > 0) {
        canvas.put(row, at + 1, TYPE_PIPE, false, NODE_FAINT);
        at += 1 + displayWidth(TYPE_PIPE) + 1;
      }
      const text = cells[cell];
      if (text !== "") writeRich(canvas, row, at, text, PLAIN_LABEL);
      at += cellWidth;
    }
    row += 1;
  }
}
