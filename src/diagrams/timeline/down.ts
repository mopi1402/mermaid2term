import type { Timeline } from "./model.js";
import { cellsFor, DOWN_EVENT_PX, DOWN_PERIOD_PX, DOWN_SECTION_PX, eventStyle, linesOf, periodsOf, UNBOUNDED } from "./periods.js";
import { displayWidth } from "../../text/width.js";
import { SPACE } from "../../text/chars.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import { sectionForeground } from "../../canvas/keys.js";

const RIGHT_MARGIN = 1;
const TEXT_AT = 5;
const RULE_ROOM = 7;

type StyledLine = ReadonlyArray<readonly [string, string]>;

const room = (budget: number | undefined, chrome: number): number =>
  budget === undefined ? UNBOUNDED : Math.max(1, budget - chrome - RIGHT_MARGIN);

export function renderTimelineVertical(diagram: Timeline, cs: CharSet = UNICODE, budget?: number): Canvas {
  if (diagram.sections.length === 0) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);

  const { vertical, horizontal, bullet } = cs;
  const rule = cs.dblHorizontal;
  const fold = (px: number, chrome: number): number => Math.min(cellsFor(px), room(budget, chrome));
  const periods = periodsOf(diagram, fold(DOWN_PERIOD_PX, TEXT_AT), fold(DOWN_EVENT_PX, TEXT_AT));
  const indent = SPACE.repeat(TEXT_AT - 2);

  const lines: StyledLine[] = [];

  let at = 0;
  diagram.sections.forEach((section, si) => {
    const style = sectionForeground(si);

    if (section.title !== "") {
      const [first, ...rest] = linesOf(section.title, fold(DOWN_SECTION_PX, RULE_ROOM));
      lines.push([[` ${rule}${rule} ${first} ${rule}${rule}`, style]]);
      for (const line of rest) lines.push([[`    ${line}`, style]]);
      lines.push([[` ${vertical}`, style]]);
    }

    section.events.forEach((_, ei) => {
      const period = periods[at];
      at += 1;
      const colour = sectionForeground(period.colour);
      const trunk: readonly [string, string] = [` ${vertical}`, colour];
      const lastPeriod = ei === section.events.length - 1 && si === diagram.sections.length - 1;

      const [first, ...rest] = period.title;
      lines.push([[` ${bullet}${horizontal}${horizontal} ${first}`, colour]]);
      for (const line of rest) lines.push([trunk, [`${indent}${line}`, colour]]);
      // A folded period stands apart from its first event, which would otherwise read as one more of its lines.
      if (rest.length > 0 && period.details.length > 0) lines.push([trunk]);
      for (const detail of period.details) lines.push(detail === "" ? [trunk] : [trunk, [`${indent}${detail}`, eventStyle(period.colour)]]);
      if (!lastPeriod) lines.push([trunk]);
    });
  });

  const widths = lines.map((pieces) => pieces.reduce((total, [text]) => total + displayWidth(text), 0));
  const width = (widths.length === 0 ? EMPTY_SIZE : Math.max(...widths)) + RIGHT_MARGIN;
  const canvas = new Canvas(width, lines.length);
  lines.forEach((pieces, row) => {
    let col = 0;
    for (const [text, style] of pieces) {
      canvas.putText(row, col, text, style);
      col += displayWidth(text);
    }
  });
  return canvas;
}
