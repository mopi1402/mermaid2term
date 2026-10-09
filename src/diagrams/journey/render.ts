import { DEFAULT_SCORE, type Journey } from "./model.js";
import { centredAt, centredOffset, descendingCaps, displayWidth, narrowerFit, widestOf, wordWrap } from "../../text/width.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import { EDGE, JOURNEY_ACTOR, JOURNEY_BAND_PREFIX, JOURNEY_LEGEND, JOURNEY_SCALE, JOURNEY_SECTION_LABEL_PREFIX, JOURNEY_TITLE, RIM_TAIL, RULE, SLAB_TAIL, indexed, sectionForeground } from "../../canvas/keys.js";
import { widenFrame } from "../../canvas/fit-frame.js";
import { SLAB_LEFT, SLAB_RIGHT, slabOutline } from "../../graph/render/slabs.js";
import { type BorderMode } from "../../source/config.js";
import { SPACE } from "../../text/chars.js";
import { baseKey } from "../../paint/mix.js";
import { JOURNEY_ACTORS } from "../../paint/journey.js";
import { cornersOf } from "../../canvas/corners.js";
import { frame, putCentredLines } from "../../canvas/shape-frame.js";
import { clearRect } from "../../canvas/cells.js";
import { layBand } from "../../canvas/band.js";
import { titledAbove } from "../@common/titled.js";
import { sectionBand } from "../@common/section-band.js";
import { spanOf } from "../../canvas/extent.js";

const MIN_TASK_WIDTH = 8;
const TASK_WIDTH_FACTOR = 4;
const LEFT_MARGIN = 2;
const RIGHT_MARGIN = 4;
const DROP_ROWS = 5;

const STYLE_GRID = RULE;
const actorStyle = (index: number): string => indexed(JOURNEY_ACTOR, index % JOURNEY_ACTORS);

interface Squeeze {
  leftMargin: number;
  sectionGap: number;
  blockGap: number;
  // Whether a section's name folds over its tasks rather than widening them to hold it on one line.
  foldNames: boolean;
}

interface PlannedTask {
  lines: string[];
  score: number;
  actors: string[];
  width: number;
  x: number;
  section: number;
}

interface Span {
  readonly start: number;
  readonly end: number;
  readonly lines: readonly string[];
}

interface Plan {
  tasks: PlannedTask[];
  spans: Span[];
  totalWidth: number;
}

// The header's two corners, which its name may reach.
const HEADER_PAD = 2;

function planned(diagram: Journey, linesPer: string[][], paddingX: number, squeeze: Squeeze): Plan {
  const taskWidth = Math.max(MIN_TASK_WIDTH, paddingX * TASK_WIDTH_FACTOR);
  const tasks: PlannedTask[] = [];
  const spans: Span[] = [];
  let x = squeeze.leftMargin;
  let flat = 0;
  diagram.sections.forEach((section, si) => {
    if (si > 0) x += squeeze.sectionGap;
    const start = x;
    const own = section.tasks.map((task) => {
      const lines = linesPer[flat] ?? [task.title];
      flat += 1;
      return { task, lines, width: Math.max(taskWidth, widestOf(lines) + paddingX * 2) };
    });
    // Short of room the section's name folds over its tasks, as mermaid wraps it in its rect, a word too long widening them.
    const held = own.map(({ width }) => width);
    const room = squeeze.foldNames ? spanOf(held, squeeze.blockGap) - HEADER_PAD : Number.POSITIVE_INFINITY;
    const band = sectionBand(section.title, room, held, squeeze.blockGap, HEADER_PAD);
    own.forEach(({ task, lines }, ti) => {
      if (ti > 0) x += squeeze.blockGap;
      const width = band.widths[ti];
      tasks.push({ lines, score: task.score, actors: task.actors, width, x, section: si });
      x += width;
    });
    spans.push({ start, end: x - 1, lines: own.length === 0 ? [section.title] : band.lines });
  });
  return { tasks, spans, totalWidth: x + squeeze.blockGap + RIGHT_MARGIN };
}

export function renderJourney(
  diagram: Journey,
  cs: CharSet = UNICODE,
  paddingX = 2,
  gap = 1,
  rounded = true,
  budget?: number,
  autoWrap = true,
  borders: BorderMode = "default",
  filled = false
): Canvas {
  if (diagram.sections.length === 0) {
    return titledAbove(new Canvas(EMPTY_SIZE, EMPTY_SIZE), diagram.title, { key: JOURNEY_TITLE, left: LEFT_MARGIN, budget });
  }

  const faceOf = (score: number): string => cs.faces[score - 1] ?? (cs.faces[DEFAULT_SCORE - 1]);
  const symbols = cs.actorSymbols;
  const horizontal = cs.horizontal;
  const corners = cornersOf(cs, rounded);
  const [topLeft, topRight] = corners;
  const arrow = cs.arrowRight;

  const titles = diagram.sections.flatMap((section) => section.tasks.map((task) => task.title));
  let lines = titles.map((title) => [title]);
  let p = Math.max(1, paddingX);
  let g = Math.max(1, gap);
  let squeeze: Squeeze = { leftMargin: LEFT_MARGIN, sectionGap: g, blockGap: g, foldNames: false };
  let plan = planned(diagram, lines, p, squeeze);

  if (budget !== undefined) {
    const fits = (): boolean => plan.totalWidth - 1 <= budget;
    while (!fits() && g > 1) {
      g -= 1;
      squeeze = { ...squeeze, sectionGap: g, blockGap: g };
      plan = planned(diagram, lines, p, squeeze);
    }
    while (!fits() && p > 1) {
      p -= 1;
      plan = planned(diagram, lines, p, squeeze);
    }
    if (!fits()) {
      squeeze = { ...squeeze, foldNames: true };
      plan = planned(diagram, lines, p, squeeze);
    }
    if (!fits() && autoWrap) {
      const refold = (cap: number): { lines: string[][]; plan: Plan } => {
        const folded = titles.map((title) => wordWrap(title, cap));
        return { lines: folded, plan: planned(diagram, folded, p, squeeze) };
      };
      ({ lines, plan } = narrowerFit(descendingCaps(widestOf(titles)), refold, (tried) => tried.plan.totalWidth - 1, budget, { lines, plan }));
    }
    if (!fits()) {
      squeeze = { ...squeeze, leftMargin: 1 };
      plan = planned(diagram, lines, p, squeeze);
    }
    if (!fits()) {
      squeeze = { ...squeeze, sectionGap: 0 };
      plan = planned(diagram, lines, p, squeeze);
    }
    if (!fits()) {
      squeeze = { ...squeeze, blockGap: 0 };
      plan = planned(diagram, lines, p, squeeze);
    }
  }

  const { tasks, spans, totalWidth } = plan;
  const actors = new Set<string>();
  for (const task of tasks) for (const actor of task.actors) actors.add(actor);
  const legend = [...actors].sort();

  const inner = Math.max(1, ...tasks.map((task) => task.lines.length));

  const sectionRow = 0;
  // Tasks written before any `section` belong to none, and mermaid draws no header over them.
  const headed = diagram.sections.some((section) => section.title !== "");
  const boxTop = headed ? sectionRow + Math.max(1, ...spans.map(({ lines }) => lines.length)) : sectionRow;
  const boxBottom = boxTop + inner + 1;
  const midRow = boxTop + 1 + Math.floor((inner - 1) / 2);
  const dropTop = boxBottom + 1;
  const dropBottom = dropTop + DROP_ROWS - 1;

  const legendSeats: Array<{ y: number; x: number; ai: number; actor: string }> = [];
  const legendSeparators: Array<{ y: number; x: number }> = [];
  {
    let ly = 0;
    let lx = squeeze.leftMargin;
    legend.forEach((actor, ai) => {
      const entry = 2 + displayWidth(actor);
      if (ai > 0 && lx + 3 + entry <= totalWidth - 1) {
        legendSeparators.push({ y: ly, x: lx + 1 });
        lx += 3;
      } else if (ai > 0) {
        ly += 1;
        lx = squeeze.leftMargin;
      }
      legendSeats.push({ y: ly, x: lx, ai, actor });
      lx += entry;
    });
  }
  const legendRows = legend.length > 0 ? legendSeats[legendSeats.length - 1].y + 1 : 0;
  const canvas = new Canvas(totalWidth + 1, dropBottom + 2 + Math.max(1, legendRows));

  const legendRow = dropBottom + 2;
  for (const { y, x } of legendSeparators) canvas.put(legendRow + y, x, "|");
  for (const { y, x, ai, actor } of legendSeats) {
    const style = actorStyle(ai);
    canvas.put(legendRow + y, x, symbols[ai % symbols.length], false, style);
    canvas.putText(legendRow + y, x + 2, actor, JOURNEY_LEGEND);
  }

  const padless = borders === "padless";
  const slabbed = borders === "borderless" && filled;
  spans.forEach(({ start, end, lines: names }, si) => {
    if (!headed) return;
    const style = sectionForeground(si);
    canvas.put(sectionRow, start, topLeft, false, style);
    canvas.putRow(sectionRow, start + 1, end, horizontal, false, style);
    canvas.put(sectionRow, end, topRight, false, style);

    // The first line cuts into the header's rule, the others stand under it.
    names.forEach((name, down) => {
      const row = sectionRow + down;
      const at = Math.max(start + 1, start + centredAt(end - start, name));
      const from = Math.max(at - 1, start + 1);
      clearRect(canvas, row, from, 1, Math.min(at + displayWidth(name) + 1, end) - from);
      canvas.putText(row, at, name, indexed(JOURNEY_SECTION_LABEL_PREFIX, si));
    });
    layBand(canvas, sectionRow, sectionRow + names.length - 1, start + 1, end - 1, JOURNEY_BAND_PREFIX + si);
    reborderHeader(canvas, sectionRow, start, end, style, padless, slabbed);
  });

  canvas.putRow(midRow, 1, totalWidth - 2, horizontal, false, EDGE);
  canvas.put(midRow, totalWidth - 2, arrow, false, EDGE);

  for (let r = dropTop; r <= dropBottom; r++) {
    canvas.putRow(r, 1, totalWidth - 2, horizontal, false, STYLE_GRID);
    canvas.put(r, totalWidth - 4, String(dropBottom - r + 1), false, JOURNEY_SCALE);
  }

  for (const task of tasks) {
    const style = sectionForeground(task.section);
    const { x: left, width } = task;

    frame(canvas, left, boxTop, width, boxBottom - boxTop + 1, cs, style, corners, undefined, { merge: false });
    clearRect(canvas, boxTop + 1, left + 1, boxBottom - boxTop - 1, width - 2);

    const firstLine = boxTop + 1 + centredOffset(inner, task.lines.length);
    putCentredLines(canvas, firstLine, left, width, task.lines, indexed(JOURNEY_SECTION_LABEL_PREFIX, task.section));

    let actorX = left + 1;
    legend.forEach((actor, ai) => {
      if (!task.actors.includes(actor)) return;
      canvas.put(boxTop, actorX, symbols[ai % symbols.length], false, actorStyle(ai));
      actorX += 1;
    });
    const edges = { top: boxTop, bottom: boxBottom, left, right: left + width - 1 };
    if (padless) widenFrame(canvas, boxTop, boxBottom, left, left + width - 1, style, rounded);
    if (slabbed) slabOutline(canvas, edges, style + SLAB_TAIL, (r, c) => canvas.getStyle(r, c) === style);

    const dropX = left + Math.floor((width - 1) / 2);

    const level = Math.min(DROP_ROWS, Math.max(1, task.score));
    const face = faceOf(task.score);
    const faceRow = dropBottom - (level - 1);
    const faceX = dropX - Math.floor((displayWidth(face) - 1) / 2);
    for (let c = faceX; c < faceX + displayWidth(face); c++) canvas.setStyle(faceRow, c, "");
    canvas.putText(faceRow, faceX, face);
  }

  // Once the border mode moves a task's lid off its ground the band starts under it, and a wall inked on the outer edge
  // of its cell stands on the band, as a padless node's does.
  const bandTop = padless || slabbed ? boxTop + 1 : boxTop;
  for (const task of tasks) {
    const band = String(task.section);
    layBand(canvas, bandTop, dropBottom, task.x + 1, task.x + task.width - 2, band);
    if (!padless) continue;
    const rim = sectionForeground(task.section) + RIM_TAIL;
    // An actor's mark on the lid stands on the ground the lid does.
    const lidGrounded = canvas.getStyle(boxTop, task.x + task.width - 2) === rim;
    for (let r = boxTop; r <= boxBottom; r++) {
      for (let c = task.x; c < task.x + task.width; c++) {
        const key = canvas.getStyle(r, c);
        if (key === rim || (r === boxTop && lidGrounded && key.startsWith(JOURNEY_ACTOR))) layBand(canvas, r, r, c, c, band);
      }
    }
  }

  return titledAbove(canvas, diagram.title, { key: JOURNEY_TITLE, left: squeeze.leftMargin, budget });
}

// A section's header is a lid alone: padless moves it onto the edge of its cells as it moves a box's rule, borderless
// leaves its band as a slab one row tall, the name standing in it, where a theme lays one.
function reborderHeader(canvas: Canvas, row: number, start: number, end: number, key: string, padless: boolean, slabbed: boolean): void {
  if (padless) widenFrame(canvas, row, row, start, end, key, false);
  if (!slabbed) return;
  for (let c = start; c <= end; c++) {
    if (canvas.isText(row, c) || baseKey(canvas.getStyle(row, c)) !== key) continue;
    if (c !== start && c !== end) {
      canvas.recast(row, c, SPACE);
      continue;
    }
    canvas.recast(row, c, c === start ? SLAB_LEFT : SLAB_RIGHT);
    canvas.setStyle(row, c, key + SLAB_TAIL);
  }
}
