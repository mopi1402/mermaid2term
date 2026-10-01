import { themeRgb } from "../colour/colours.js";
import {
  ACTIVE_INDEXED,
  ACTIVE_MARK_INDEXED,
  COMPOSITE,
  FILL_TAIL,
  LABEL,
  NOTE,
  NOTE_FILL,
  NOTE_LABEL,
  NOTE_RIM,
  OUT_TAIL,
  RIM_TAIL, SLAB_TAIL,
  indexAfter,
  indexed,
} from "../canvas/keys.js";
import { gain, mixRGB } from "../colour/palette.js";
import { WHITE_RGB, colourValue, formatHex, parseHex, type RGB } from "../colour/rgb.js";
import { RULE_RATIO, readableStyle } from "../colour/contrast.js";
import { must } from "../must.js";
import { SPACE } from "../text/chars.js";
import { ACTIVE_MIX, plainLabel, textOnFill } from "./labels.js";
import { BACKGROUND, BOLD, EMPTY, REVERSE } from "./tokens.js";
import { baseKey, firstHex, firstInk, pageOf, slabInk } from "./mix.js";
import { without } from "./style.js";
import { type Theme } from "./theme-model.js";

const NOTE_RULE_FADE = 0.8;

export const noteInks = (th: Theme): { rule: string; fill: string; label: string } => {
  const slab = th.variables.noteBkgColor;
  const ink = th.variables.noteTextColor;
  if (slab === undefined) return { rule: BOLD, fill: REVERSE, label: `${BOLD} ${REVERSE}`.trim() };
  const ground = BACKGROUND + slab;
  const faded = parseHex(slab);
  return {
    // mermaid strokes a note `noteBorderColor` in the state, class and sequence sheets alike.
    rule: th.variables.noteBorderColor ?? (faded === undefined ? slab : formatHex(gain(faded, NOTE_RULE_FADE))),
    fill: ground,
    label: `${ink ?? EMPTY} ${ground}`.trim(),
  };
};

export const noteStyles = (th: Theme): Array<[string, string]> => {
  const note = noteInks(th);
  return [
    [NOTE, note.rule],
    [NOTE_FILL, note.fill],
    [NOTE_RIM, `${note.rule} ${note.fill}`.trim()],
    [NOTE_LABEL, note.label],
    [`${NOTE}${SLAB_TAIL}`, slabInk(note.fill, note.rule)],
  ];
};

export const weighed = (weight: string, ink: string | undefined, none: string): string =>
  ink === undefined ? none : `${weight} ${ink}`.trim();

// A participant's seat on `borderColorArray`, which only mermaid's two colour themes state.
const ringOf = (th: Theme, index: number | undefined): number | undefined => {
  const ring = th.variables.borderColorArray;
  return index === undefined || ring === undefined || ring.length === 0 ? undefined : index % ring.length;
};

export const actorInks = (th: Theme, index?: number): { rule: string; fill: string | undefined; label: string } => {
  const v = th.variables;
  const ring = ringOf(th, index);
  const stroke = ring === undefined ? v.actorBorder : (must(v.borderColorArray))[ring] ?? v.actorBorder;
  const bkg = ring === undefined || v.bkgColorArray === undefined ? v.actorBkg : v.bkgColorArray[ring] ?? v.actorBkg;
  const rule = stroke === undefined ? th.node : `${th.weights.node} ${stroke}`.trim();
  const ground = themeRgb(bkg);
  // mermaid writes a participant's name in `actorTextColor` (`text.actor > tspan`), which falls back on the page's
  // own primary text, the ink this label already carries.
  const written = v.actorTextColor ?? th.label;
  if (ground === undefined) return { rule, fill: undefined, label: written };
  return { rule, fill: BACKGROUND + formatHex(ground), label: textOnFill(written, ground).trim() };
};

// mermaid's `drawActivation` strokes a colour theme's bar in its participant's `borderColorArray` seat and fills it
// from `bkgColorArray`, or `mainBkg` where that is unstated; every other theme keeps the activation variables.
export const activationInks = (th: Theme, index?: number): { rule: string; mark: string } => {
  const v = th.variables;
  const ring = ringOf(th, index);
  const stroke = ring === undefined ? v.activationBorderColor : (must(v.borderColorArray))[ring];
  const bkg = ring === undefined ? v.activationBkgColor : v.bkgColorArray?.[ring] ?? v.mainBkg;
  const page = pageOf(th);
  const namedFill = bkg === undefined ? undefined : colourValue(bkg);
  const namedStroke = stroke === undefined ? undefined : colourValue(stroke);
  // Half the SIGNAL's ink, which is the arrow the activation opens on: the band is the arrow's own box.
  const ink = namedStroke ?? namedFill ?? mixRGB(page, firstInk(signalInks(th).head) ?? WHITE_RGB, ACTIVE_MIX);
  const ground = namedFill ?? ink;
  return {
    rule: readableStyle(formatHex(ink), page, RULE_RATIO, RULE_RATIO),
    mark: textOnFill(plainLabel(th), ground),
  };
};

// Every bar the canvas seats on a participant, and its stacked count, inked from that participant's seat.
export const layActivationKeys = (styleMap: Map<string, string>, th: Theme, keys: Iterable<string>): void => {
  for (const key of keys) {
    const bar = indexAfter(baseKey(key), ACTIVE_INDEXED);
    if (bar !== undefined) styleMap.set(indexed(ACTIVE_INDEXED, bar), activationInks(th, bar).rule);
    const mark = indexAfter(baseKey(key), ACTIVE_MARK_INDEXED);
    if (mark !== undefined) styleMap.set(indexed(ACTIVE_MARK_INDEXED, mark), activationInks(th, mark).mark);
  }
};

export const layActorKeys = (styleMap: Map<string, string>, base: string, inks: ReturnType<typeof actorInks>): void => {
  styleMap.set(base, inks.rule);
  styleMap.set(`${base}${COMPOSITE}${LABEL}`, inks.label);
  styleMap.set(`${base}${OUT_TAIL}`, inks.rule);
  styleMap.set(`${base}${RIM_TAIL}`, inks.fill === undefined ? inks.rule : `${inks.rule} ${inks.fill}`.trim());
  styleMap.set(`${base}${SLAB_TAIL}`, slabInk(inks.fill ?? undefined, inks.rule));
  if (inks.fill !== undefined) styleMap.set(base + FILL_TAIL, inks.fill);
};

const NODE_FADE = 0.5;

export const fadedNode = (th: Theme): string => {
  const words = without(th.node, BOLD).split(SPACE);
  let hasHex = false;
  const faded = words.map((word) => {
    const rgb = parseHex(word);
    if (rgb === undefined) return word;
    hasHex = true;
    return formatHex(gain(rgb, NODE_FADE));
  });
  return hasHex ? faded.join(SPACE) : `dim ${faded.join(SPACE)}`;
};

const frameInk = (th: Theme): RGB | undefined => {
  const named = th.variables.actorLineColor;
  const ink = named === undefined ? firstHex(th.node) : themeRgb(named);
  return ink === undefined ? undefined : mixRGB(pageOf(th), ink, th.frameOpacity);
};

export const frameStyle = (th: Theme): string => {
  const ink = frameInk(th);
  return ink === undefined ? fadedNode(th) : formatHex(ink);
};

// mermaid strokes the arrow, its head and the numbered disc with `signalColor`, and writes the message with
// `signalTextColor`; both fall back on the page's own text, which is what this theme's edge already carries.
export const signalInks = (th: Theme): { head: string; line: string; label: string } => {
  const v = th.variables;
  return {
    head: weighed(th.weights.arrow, v.signalColor, th.arrow),
    line: weighed(th.weights.edge, v.signalColor, th.edge),
    label: weighed(th.weights.edgeLabel, v.signalTextColor, th.edgeLabel),
  };
};

// `.loopLine` takes `labelBoxBorderColor`, the label box's own stroke and not a frame colour of its own. The fade
// this page gives a frame stays: a dotted rule at full strength reads louder on a grid than a stroke does in an SVG.
export const loopLine = (th: Theme): string => {
  const named = th.variables.labelBoxBorderColor;
  const ink = themeRgb(named);
  return ink === undefined ? frameStyle(th) : formatHex(mixRGB(pageOf(th), ink, th.frameOpacity));
};

// The tab is mermaid's `.labelBox`, filled with `labelBoxBkgColor` and written in `labelTextColor`; a section's own
// title is `.sectionTitle`, which takes `loopTextColor` and stands on the same ground here.
export const labelBox = (th: Theme, ink: string | undefined): string => {
  const v = th.variables;
  const ground = themeRgb(v.labelBoxBkgColor);
  if (ground === undefined) return frameTab(th);
  return textOnFill(weighed(th.weights.label, ink, plainLabel(th)), ground).trim();
};

export const frameTab = (th: Theme): string => {
  const ink = frameInk(th);
  return ink === undefined
    ? `${fadedNode(th)} ${REVERSE}`
    : textOnFill(plainLabel(th), ink);
};
