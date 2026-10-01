import { themeRgb } from "../colour/colours.js";
import {
  BAND_MARK, CLICKABLE_TAIL, CRIT, CRIT_BORDER, EDGE_LABEL, EXCLUDED_BAND, GANTT_AXIS_TEXT, GANTT_BAND_PREFIX, GANTT_GRID, GANTT_MILESTONE, GRID, GANTT_OUTSIDE_ACTIVE_TEXT,
  GANTT_OUTSIDE_TEXT, GANTT_SECTION_TITLE_PREFIX,
  GANTT_INSIDE_PREFIX, GANTT_TASK, GANTT_TITLE, LABEL, NODE, SECTION_BACKGROUND_PREFIX, TASK_ACTIVE,
  TASK_DONE,
} from "../canvas/keys.js";
import { QUIET_RATIO, RULE_RATIO, readableStyle } from "../colour/contrast.js";
import { CHANNEL_MAX, HEX_BASE, formatHex, parseHex, type RGB } from "../colour/rgb.js";
import { textOnFill } from "./labels.js";
import { inked } from "./style.js";
import { mixRGB } from "../colour/palette.js";
import { firstInk, pageOf, withWeight } from "./mix.js";
import { sectionInks, seatOf, seatOnPage, textOnPage } from "./sections.js";
import { BACKGROUND, BOLD, EMPTY } from "./tokens.js";
import { type GanttVariables, type Ink, type Theme, seatIn } from "./theme-model.js";

// `.section { opacity: 0.2 }`, laid over the page.
const SECTION_OPACITY = 0.2;
// `.grid .tick { opacity: 0.8 }`, the theme's grid colour laid over the page.
const GRID_OPACITY = 0.8;
// mermaid inks a milestone as a task; here the milestones share an amber no other part of the chart wears, the mark,
// its line and its name read as one.
const MILESTONE_INK = "#ffb000";
const HEX_LENGTH = 7;
const DIGITS_RE = /^\d+$/u;

// mermaid's `numberSectionStyles` rects: `.section0`, `.section1`, `.section2`, `.section3`.
const SECTION_FILLS: ReadonlyArray<keyof GanttVariables> = ["sectionBkgColor", "altSectionBkgColor", "sectionBkgColor2", "altSectionBkgColor"];

// A theme file's colour with its own alpha, `#rrggbbaa`, as `default` states `sectionBkgColor`.
function withAlpha(ink: Ink): { rgb: RGB; alpha: number } | undefined {
  if (ink === undefined) return undefined;
  const rgb = parseHex(ink.slice(0, HEX_LENGTH).toLowerCase());
  if (rgb === undefined) {
    const named = themeRgb(ink);
    return named === undefined ? undefined : { rgb: named, alpha: 1 };
  }
  const pair = ink.slice(HEX_LENGTH);
  return { rgb, alpha: pair === EMPTY ? 1 : Number.parseInt(pair, HEX_BASE) / CHANNEL_MAX };
}

// The sections a drawing names, off its band tails and its section titles.
function sectionsOf(keys: Iterable<string>): Set<number> {
  const found = new Set<number>();
  for (const key of keys) {
    const title = key.indexOf(GANTT_SECTION_TITLE_PREFIX);
    const index = title === -1 ? Number.NaN : Number.parseInt(key.slice(title + GANTT_SECTION_TITLE_PREFIX.length), 10);
    if (Number.isInteger(index)) found.add(index);
    const band = key.lastIndexOf(BAND_MARK + GANTT_BAND_PREFIX);
    const tail = band === -1 ? EMPTY : key.slice(band + BAND_MARK.length + GANTT_BAND_PREFIX.length);
    if (DIGITS_RE.test(tail)) found.add(Number(tail));
  }
  return found;
}

// A mermaid theme states the inks its gantt stylesheet reads; a theme that states none keeps the section scale and the
// state inks it always drew with, every key below falling back on the one it stood for.
export function ganttStyles(th: Theme, keys: Iterable<string>, styleMap: ReadonlyMap<string, string>): Array<[string, string]> {
  const v = th.variables;
  const page = pageOf(th);
  const palette = v.sectionBkgColor !== undefined;
  const onPage = (weight: string, ink: Ink, fallback: string): string => (palette ? seatOnPage(th, ink, weight, fallback) : fallback);
  const text = (weight: string, ink: Ink, fallback: string): string => (palette ? textOnPage(th, ink, weight) : undefined) ?? fallback;
  const own = (key: string): string => styleMap.get(key) ?? EMPTY;
  const task = onPage(th.weights.node, v.taskBkgColor, th.node);
  const done = palette ? onPage(EMPTY, v.doneTaskBkgColor, own(TASK_DONE)) : own(TASK_DONE);
  const active = palette ? onPage(BOLD, v.activeTaskBkgColor, own(TASK_ACTIVE)) : own(TASK_ACTIVE);
  const crit = palette ? onPage(BOLD, v.critBkgColor, own(CRIT)) : own(CRIT);
  const gridInk = themeRgb(v.gridColor);
  const styles: Array<[string, string]> = [
    [GANTT_GRID, gridInk === undefined ? own(GRID) : formatHex(mixRGB(page, gridInk, GRID_OPACITY))],
    [GANTT_TASK, palette ? task : own(NODE)],
    [TASK_DONE, done],
    [TASK_ACTIVE, active],
    [CRIT, crit],
    [CRIT_BORDER, onPage(BOLD, v.critBorderColor, crit)],
    [GANTT_OUTSIDE_TEXT, text(th.weights.edgeLabel, v.taskTextOutsideColor, own(EDGE_LABEL))],
    [GANTT_OUTSIDE_ACTIVE_TEXT, text(th.weights.edgeLabel, v.taskTextDarkColor, text(th.weights.edgeLabel, v.taskTextOutsideColor, own(EDGE_LABEL)))],
    // `.grid .tick text { fill: textColor }`, in no weight of its own.
    [GANTT_AXIS_TEXT, text(EMPTY, v.textColor, own(EDGE_LABEL))],
    [GANTT_TITLE, text(th.weights.label, v.titleColor, own(LABEL))],
    [GANTT_MILESTONE, readableStyle(inked(BOLD, MILESTONE_INK), page)],
  ];
  // mermaid writes a name inside its bar in `taskTextColor`, or `taskTextDarkColor` on a done or active fill, crit or not.
  const inside: ReadonlyArray<readonly [key: string, fill: Ink, ink: Ink, weight: string, fallback: string]> = [
    [GANTT_TASK, v.taskBkgColor, v.taskTextColor, th.weights.node, palette ? task : own(NODE)],
    [TASK_DONE, v.doneTaskBkgColor, v.taskTextDarkColor, EMPTY, done],
    [TASK_ACTIVE, v.activeTaskBkgColor, v.taskTextDarkColor, BOLD, active],
    [CRIT, v.critBkgColor, v.taskTextColor, BOLD, crit],
    [CRIT_BORDER, v.critBorderColor, v.taskTextDarkColor, BOLD, onPage(BOLD, v.critBorderColor, crit)],
  ];
  // mermaid's `.clickable` rules write a clickable name bold in `taskTextClickableColor`, inside its bar or out.
  const clickInk = palette ? v.taskTextClickableColor : undefined;
  const outside = styles.find(([key]) => key === GANTT_OUTSIDE_TEXT)?.[1] ?? EMPTY;
  styles.push([GANTT_OUTSIDE_TEXT + CLICKABLE_TAIL, clickInk === undefined ? withWeight(outside, BOLD) : readableStyle(inked(BOLD, clickInk), page)]);
  for (const [key, fill, ink, weight, fallback] of inside) {
    const stated = !palette || fill === undefined || ink === undefined ? undefined : themeRgb(fill);
    // A theme that states no fill grounds the name on the bar's own ink, written in the page's colour.
    const ground = stated ?? firstInk(fallback);
    const writing = stated === undefined ? inked(weight, formatHex(page)) : inked(weight, ink ?? EMPTY);
    const onBar = (said: string): string => (ground === undefined ? fallback : textOnFill(said, ground));
    styles.push(
      [GANTT_INSIDE_PREFIX + key, onBar(writing)],
      [GANTT_INSIDE_PREFIX + key + CLICKABLE_TAIL, withWeight(onBar(clickInk === undefined ? writing : inked(BOLD, clickInk)), BOLD)],
    );
  }
  const excluded = palette ? themeRgb(v.excludeBkgColor) : undefined;
  if (excluded !== undefined) styles.push([SECTION_BACKGROUND_PREFIX + EXCLUDED_BAND, BACKGROUND + formatHex(excluded)]);
  for (const n of sectionsOf(keys)) {
    const seat = th.sectionColors.length === 0 ? undefined : themeRgb(th.sectionColors[seatOf(th, n)]);
    const fill = palette ? withAlpha(v[seatIn(SECTION_FILLS, n)]) : undefined;
    if (fill === undefined) {
      if (seat === undefined) continue;
      const inks = sectionInks(th, seat);
      styles.push([SECTION_BACKGROUND_PREFIX + GANTT_BAND_PREFIX + n, inks.band], [GANTT_SECTION_TITLE_PREFIX + n, inks.ink]);
      continue;
    }
    const wash = mixRGB(page, fill.rgb, SECTION_OPACITY * fill.alpha);
    const title = v.titleColor === undefined ? EMPTY : readableStyle(inked(BOLD, v.titleColor), wash, QUIET_RATIO, RULE_RATIO);
    styles.push([SECTION_BACKGROUND_PREFIX + GANTT_BAND_PREFIX + n, BACKGROUND + formatHex(wash)], [GANTT_SECTION_TITLE_PREFIX + n, title]);
  }
  return styles;
}
