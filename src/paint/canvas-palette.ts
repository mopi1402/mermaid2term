import {
  ABSTRACT_LABEL, ACTIVE, ACTIVE_MARK, ACTOR, BOX, CRIT, DEEP_SUFFIX, DIM_SUFFIX, EDGE_CHIP, EXCLUDED_BAND, FRAME,
  FRAME_TAB, GRID, LABEL_BOX, LIFELINE, LOOP_LABEL, LOOP_LINE, MARKER, NODE, NODE_FAINT, NODE_FAINT_STRIPE,
  PLAIN_LABEL, PLAIN_LABEL_STRIPE, RIM_TAIL, RULE, SECTION_BACKGROUND_PREFIX, SECTION_FOREGROUND_PREFIX, SECTION_PREFIX,
  SECTION_ROOT, SIGNAL, SIGNAL_LABEL, SIGNAL_LINE, SLAB_TAIL, STATIC_LABEL_KEY, STRIPE, TASK_ACTIVE, TASK_DONE,
  THEME_FILL_BAND, THEME_NOTE_BAND, THEME_RECT_BAND, THEME_ROW_EVEN_BAND, THEME_ROW_ODD_BAND, TIMELINE_EVENT_PREFIX, TODAY,
} from "../canvas/keys.js";
import { colourToHex, cssColour, themeRgb } from "../colour/colours.js";
import { contrastRatio } from "../colour/contrast.js";
import { formatHex, parseHex, type RGB } from "../colour/rgb.js";
import { baseStyles } from "./base-styles.js";
import { boardEdgeStyles } from "./board-edges.js";
import { edgeChip } from "./chips.js";
import { activationInks, actorInks, fadedNode, frameStyle, frameTab, labelBox, layActorKeys, loopLine, noteStyles, signalInks, weighed } from "./frames.js";
import { journeyStyles } from "./journey.js";
import { MERMAID_THEME_NAMES } from "./mermaid-themes.js";
import { MARKER_DROPS, faintOf, plainLabel, underlined } from "./labels.js";
import { EXCLUDED_MIX, GRID_MIX, RULE_MIX, faintInk, pageOf, slabInk, stripeGround, stripeOf } from "./mix.js";
import { quadrantStyles } from "./quadrant.js";
import { onBand, rootBand, seatOnPage, sectionInks, shapedStyles } from "./sections.js";
import { lastGround, without } from "./style.js";
import { type Theme, seatIn } from "./theme-model.js";
import { BACKGROUND, BOLD, DIM, EMPTY, ITALIC, REVERSE } from "./tokens.js";
import { ensured } from "../must.js";

type Entries = ReadonlyArray<readonly [string, string]>;

// The canvas painter's palette a theme alone decides, in the order the painter lays it: worked out once per theme and
// not once per try of the fit. What a drawing's own keys ask for is laid between these by the painter.
export interface CanvasPalette {
  readonly head: Entries;
  readonly middle: Entries;
  readonly section: (at: number) => Entries;
  readonly root: Entries;
  readonly fills: ReadonlyMap<string, RGB | undefined>;
}

// mermaid's last ground for a `rect` written with no colour, when the theme names neither `rectBkgColor` nor `actorBkg`.
const RECT_GREY = "rgba(128, 128, 128, 0.5)";

const groundStyle = (rgb: RGB | undefined): string | undefined => (rgb === undefined ? undefined : BACKGROUND + formatHex(rgb));

// mermaid strokes a kanban column in its own fill, so the frame melts into it; a fill the page swallows keeps it drawn.
const STANDS_OUT = 1.2;
function meltedRim(band: string, page: RGB): string {
  const ground = lastGround(band);
  const fill = ground === undefined ? undefined : parseHex(ground.toLowerCase());
  if (fill === undefined || contrastRatio(fill, page) < STANDS_OUT) return band;
  const hex = formatHex(fill);
  return `${hex} ${BACKGROUND}${hex}`;
}

const recorded = (lay: (styles: Map<string, string>) => void): Entries => {
  const styles = new Map<string, string>();
  lay(styles);
  return [...styles];
};

const headOf = (th: Theme): Entries =>
  recorded((styles) => {
    const said: Entries = [
      ...baseStyles(th),
      ...noteStyles(th),
      // A borderless block, drawn outside the graph engine, is a slab of its ground as a graph node is.
      [NODE + SLAB_TAIL, slabInk(groundStyle(themeRgb(th.variables.mainBkg)), th.node)],
      [LIFELINE, th.variables.actorLineColor ?? faintOf(th)],
      [PLAIN_LABEL, plainLabel(th)],
      [ABSTRACT_LABEL, `${ITALIC} ${plainLabel(th)}`.trim()],
      [STATIC_LABEL_KEY, underlined(plainLabel(th))],
      [NODE_FAINT, fadedNode(th)],
      // mermaid strokes a sequence `box` with `nodeBorder`, the node's own stroke: `g rect.rect { stroke }` in its
      // sequence stylesheet. Left unlaid the frame took the terminal's default ink, which a block glyph cannot show.
      [BOX, th.node],
      [FRAME, frameStyle(th)],
      [FRAME_TAB, frameTab(th)],
      [SIGNAL, signalInks(th).head],
      [SIGNAL_LINE, signalInks(th).line],
      [SIGNAL_LABEL, signalInks(th).label],
      [LOOP_LINE, loopLine(th)],
      [LABEL_BOX, labelBox(th, th.variables.labelTextColor)],
      [LOOP_LABEL, labelBox(th, th.variables.loopTextColor)],
      [EDGE_CHIP, edgeChip(th)],
      ...quadrantStyles(th),
      ...journeyStyles(th),
    ];
    for (const [key, style] of said) styles.set(key, style);
    layActorKeys(styles, ACTOR, actorInks(th));
  });

const middleOf = (th: Theme): Entries =>
  recorded((styles) => {
    const stripe = stripeGround(th);
    styles.set(GRID, th.variables.gridColor ?? faintInk(th, GRID_MIX));
    styles.set(SECTION_BACKGROUND_PREFIX + EXCLUDED_BAND, BACKGROUND + faintInk(th, EXCLUDED_MIX));
    styles.set(RULE, faintInk(th, RULE_MIX));
    const v = th.variables;
    styles.set(CRIT, weighed(BOLD, v.critBkgColor, `${BOLD} ${REVERSE}`.trim()));
    styles.set(TASK_DONE, weighed(EMPTY, v.doneTaskBkgColor, DIM));
    styles.set(TASK_ACTIVE, weighed(BOLD, v.activeTaskBkgColor, BOLD));
    // The today and `vert` lines stand on the page, weighed to read there as a bar is.
    styles.set(TODAY, seatOnPage(th, v.todayLineColor, BOLD, th.arrow));
    styles.set(MARKER, seatOnPage(th, v.vertLineColor, BOLD, `${BOLD} ${MARKER_DROPS.reduce(without, th.edgeLabel)}`.trim()));
    styles.set(STRIPE, stripe);
    styles.set(PLAIN_LABEL_STRIPE, `${plainLabel(th)} ${stripe}`);
    styles.set(NODE_FAINT_STRIPE, `${fadedNode(th)} ${stripe}`);
    const activation = activationInks(th);
    styles.set(ACTIVE, activation.rule);
    styles.set(ACTIVE_MARK, activation.mark);
  });

const sectionOf = (th: Theme, i: number): Entries =>
  recorded((styles) => {
    const pageGround = pageOf(th);
    const shaped = (key: string, style: string): void => {
      for (const [shapedKey, said] of shapedStyles(key, style)) styles.set(shapedKey, said);
    };
    // mermaid's kanban `.node` rule: a card is filled `background`, the page where a theme names none, stroked `nodeBorder`.
    const cardGround = cssColour(th.variables.background) ?? formatHex(pageGround);
    const base = seatIn(th.sectionColors, i);
    const band = onBand(th, i, (th.sectionGrounds === undefined ? undefined : seatIn(th.sectionGrounds, i)) ?? base);
    shaped(`${SECTION_PREFIX}${i}`, band);
    const rim = meltedRim(band, pageGround);
    const cardRim = `${th.node} ${BACKGROUND}${cardGround}`.trim();
    styles.set(`${SECTION_PREFIX}${i}${RIM_TAIL}`, rim);
    styles.set(`${SECTION_PREFIX}${i}${DEEP_SUFFIX}`, onBand(th, i, cardGround));
    styles.set(`${SECTION_PREFIX}${i}${DEEP_SUFFIX}${RIM_TAIL}`, cardRim);
    for (const [key, style] of boardEdgeStyles(i, band, rim, cardRim, cardGround)) styles.set(key, style);
    const rgb = parseHex(base);
    if (rgb === undefined) return;
    const inks = sectionInks(th, rgb);
    styles.set(`${SECTION_FOREGROUND_PREFIX}${i}`, inks.ink);
    styles.set(`${TIMELINE_EVENT_PREFIX}${i}`, inks.ink);
    styles.set(`${SECTION_FOREGROUND_PREFIX}${i}${DIM_SUFFIX}`, inks.dim);
    styles.set(`${SECTION_BACKGROUND_PREFIX}${i}`, inks.band);
    // A borderless journey task: a slab of the band it stands in.
    styles.set(`${SECTION_FOREGROUND_PREFIX}${i}${SLAB_TAIL}`, slabInk(inks.band, inks.ink));
  });

// A row a theme leaves unbanded shows the box's own fill through it. A mermaid theme with no ER rows (neo, redux)
// leaves both transparent, so the box's fill shows through every row; a palette of this page's own keeps the stripe.
const fillsOf = (th: Theme): ReadonlyMap<string, RGB | undefined> => {
  const hexOf = themeRgb;
  const nodeFill = hexOf(th.variables.mainBkg);
  const unstriped = MERMAID_THEME_NAMES.includes(th.name) ? nodeFill : stripeOf(th);
  return new Map([
    [THEME_FILL_BAND, nodeFill],
    [THEME_NOTE_BAND, hexOf(th.variables.noteBkgColor)],
    [THEME_ROW_ODD_BAND, hexOf(th.variables.rowOdd) ?? nodeFill],
    [THEME_ROW_EVEN_BAND, hexOf(th.variables.rowEven) ?? unstriped],
    [THEME_RECT_BAND, hexOf(th.variables.rectBkgColor) ?? hexOf(th.variables.actorBkg) ?? hexOf(colourToHex(RECT_GREY))],
  ]);
};

const PALETTES = new WeakMap<Theme, CanvasPalette>();

export function canvasPalette(th: Theme): CanvasPalette {
  const known = PALETTES.get(th);
  if (known !== undefined) return known;
  const sections = new Map<number, Entries>();
  const palette: CanvasPalette = {
    head: headOf(th),
    middle: middleOf(th),
    section: (at) => ensured(sections, at, () => sectionOf(th, at)),
    root: shapedStyles(SECTION_ROOT, rootBand(th) ?? th.label),
    fills: fillsOf(th),
  };
  PALETTES.set(th, palette);
  return palette;
}

export const laid = (styles: Map<string, string>, entries: Entries): void => {
  for (const [key, style] of entries) styles.set(key, style);
};
