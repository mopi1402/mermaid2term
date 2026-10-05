import {
  ABSTRACT,
  STATIC,
  type ClassDef,
  type Member,
} from "./model.js";
import { centredAt, displayWidth } from "../../text/width.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { SPACE } from "../../text/chars.js";
import {
  BOLD_LABEL,
  NODE,
  NODE_FAINT,
  PLAIN_LABEL,
  STATIC_LABEL_KEY,
  ABSTRACT_LABEL,
} from "../../canvas/keys.js";
import { annotationText, formatMember, partitioned } from "./members.js";
import { MIN_BOX_WIDTH, nameLines } from "./metrics.js";
import { writeCentred, writeRich } from "../../canvas/rich.js";
import { plainOf, widestShown } from "../../source/markdown.js";
import { dividerRow, frame } from "../../canvas/shape-frame.js";
import { cornersOf } from "../../canvas/corners.js";

const headingLines = (cls: ClassDef): readonly string[] =>
  cls.annotation !== "" ? [annotationText(cls), ...nameLines(cls)] : nameLines(cls);

export interface Compartment {
  // The row its rule sits on, counted from the box's own top; its members follow.
  readonly rule: number;
  readonly faded: boolean;
  readonly members: readonly Member[];
}

// The compartments a class shows: mermaid's two, an empty one drawn as a blank band between its rules. A class with
// no member at all loses both under `hideEmptyMembersBox`, the knob mermaid gives for that one case.
// One reading serves the sizing, the drawing and the padless fitter, which cannot afford to drift.
export function compartmentsOf(cls: ClassDef, hideEmpty: boolean): readonly Compartment[] {
  if (cls.lollipop || (hideEmpty && cls.members.length === 0)) return [];
  const [attributes, methods] = partitioned(cls);
  let rule = 1 + headingLines(cls).length;
  return [attributes, methods].map((members, at) => {
    const own = rule;
    rule += 1 + Math.max(members.length, 1);
    return { rule: own, faded: at > 0, members };
  });
}

export function boxSize(cls: ClassDef, paddingX: number, hideEmpty = false): [number, number] {
  if (cls.lollipop) return [Math.max(widestShown(nameLines(cls)), 1), nameLines(cls).length + 1];
  const heading = headingLines(cls);
  const [attributes, methods] = partitioned(cls);
  const rows = [...heading, ...attributes.map(formatMember), ...methods.map(formatMember)];

  const widest = widestShown(rows);
  const [dw, dh] = cls.grown ?? [0, 0];
  const width = Math.max(widest + Math.max(paddingX, 1) * 2, MIN_BOX_WIDTH) + dw;

  const last = compartmentsOf(cls, hideEmpty).at(-1);
  const height = (last === undefined ? 2 + heading.length : 2 + last.rule + Math.max(last.members.length, 1)) + dh;
  return [width, height];
}

function drawDivider(canvas: Canvas, row: number, x: number, width: number, cs: CharSet): void {
  dividerRow(canvas, row, x, width, NODE, [cs.teeRight, cs.teeLeft], cs.horizontal);
}

function drawFadedDivider(canvas: Canvas, row: number, x: number, width: number, cs: CharSet): void {
  dividerRow(canvas, row, x, width, NODE, [cs.vertical, cs.vertical], cs.horizontal, NODE_FAINT);
}

const memberStyle = (member: Member): string =>
  member.classifier === ABSTRACT ? ABSTRACT_LABEL : member.classifier === STATIC ? STATIC_LABEL_KEY : PLAIN_LABEL;

function writeMember(canvas: Canvas, row: number, col: number, member: Member): void {
  const written = formatMember(member);
  const style = memberStyle(member);
  writeRich(canvas, row, col, written, style);
  if (style !== STATIC_LABEL_KEY) return;
  [...plainOf(written)].forEach((ch, at) => {
    if (ch === SPACE) canvas.setStyle(row, col + at, style);
  });
}

// Where the ring stands among the rows of its name: facing a run that comes along the column, or in the middle, on the
// row a run coming along the row arrives on.
export type RingAt = "first" | "last" | "middle";

export function drawLollipop(canvas: Canvas, x: number, y: number, cls: ClassDef, cs: CharSet, ringAt: RingAt): void {
  const [width, height] = boxSize(cls, 0);
  const lines = nameLines(cls);
  const ring = ringAt === "first" ? 0 : ringAt === "last" ? lines.length : Math.floor(height / 2);
  canvas.put(y + ring, x + Math.floor(width / 2), cs.lollipopRing, false, NODE);
  lines.forEach((line, at) => {
    writeCentred(canvas, y + (at < ring ? at : at + 1), x, width, line, BOLD_LABEL);
  });
}

export function drawClassBox(canvas: Canvas, x: number, y: number, cls: ClassDef, cs: CharSet, paddingX: number, hideEmpty: boolean): void {
  const [width, height] = boxSize(cls, paddingX, hideEmpty);
  frame(canvas, x, y, width, height, cs, NODE, cornersOf(cs, false));

  let row = y + 1;
  if (cls.annotation !== "") {
    const text = annotationText(cls);
    canvas.putText(row, x + centredAt(width, text), text, PLAIN_LABEL);
    row += 1;
  }
  for (const line of nameLines(cls)) {
    const left = writeCentred(canvas, row, x, width, line, BOLD_LABEL);
    if (cls.link !== undefined) canvas.linkLabel(row, left, displayWidth(plainOf(line)), 1, cls.link);
    row += 1;
  }

  const left = x + Math.max(paddingX, 1);
  for (const { rule, faded, members } of compartmentsOf(cls, hideEmpty)) {
    if (faded) drawFadedDivider(canvas, y + rule, x, width, cs);
    else drawDivider(canvas, y + rule, x, width, cs);
    members.forEach((member, at) => writeMember(canvas, y + rule + 1 + at, left, member));
  }
}
