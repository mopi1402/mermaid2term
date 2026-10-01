import { fromHsl, toHsl } from "../colour/hsl.js";
import { adjust, darken, invert, lighten, mkBorder, shiftChannels } from "../colour/palette.js";
import { colourValue, formatHex, type RGB } from "../colour/rgb.js";
import { inked } from "./style.js";
import { WHITE } from "./replay/blocks.js";
import { BASE_PLOT_PALETTE, CLICKABLE_BLUE, CRIT_BORDER, DARK_TEXT, EXCLUDE_GREY, GREY, LIGHT_GREY, LIGHT_TEXT, NAVY, NOTE_SLAB, RED } from "./replay/modern.js";
import { leftUnset, replayed } from "./replay/replay.js";
import { BARE, DEFAULT_SECTION_COLORS, SECTION_SEATS, DEFAULT_WEIGHTS, FRAME_OPACITY, LIFELINE_WIDTH, NO_STYLE, type Ink, type PieVariables, type GitRootVariables, type GitVariables, GIT_INV_NAMES, GIT_LABEL_NAMES, GIT_SEAT_NAMES, INK_SOURCES, OWN_FALLBACKS, type FallingInk, type GanttVariables, type InkName, type ThemeInk, type JourneyVariables, markerOf, type QuadrantVariables, type StatedInk, type StatedVariables, type Theme, type ThemeSource, type ThemeVariables } from "./theme-model.js";

// The derivation a palette of this page's own is given: `theme-base.js`'s fallbacks as this package has always
// read them, each colour rounded to hex at every step. A mermaid theme replays its own file instead (`replay/`).

const ACTIVE_LIGHTEN = 23;

const ACTIVATION_DARKEN = 10;

const SECONDARY_TURN = -120;

const TERTIARY_TURN = 180;

const TERTIARY_LIFT = 5;

const EDGE_LABEL_DARKEN = 30;

// `theme-base.js`: an ER row off the box's fill, odd and even, in dark mode and out of it.
const ROW_ODD_DARK = 5;
const ROW_EVEN_DARK = 10;
const ROW_ODD_LIGHT = 75;
const ROW_EVEN_LIGHT = 5;

interface Turn {
  readonly h?: number;
  readonly l?: number;
}

// `theme-base.js`: seat 8 also takes `l: 150`, which clamps to white before the scale is darkened.
const SCALE_TURNS: readonly Turn[] = [{ h: 30 }, { h: 60 }, { h: 90 }, { h: 120 }, { h: 150 }, { h: 210, l: 150 }, { h: 270 }, { h: 300 }, { h: 330 }];

const SCALE_DARKEN_DARK = 75;

const SCALE_DARKEN_LIGHT = 25;

// `theme-base.js`: each `cScalePeer` seat its `cScale` seat lightened in dark mode, darkened otherwise.
const PEER_STEP = 10;

const PERCENT = 100;

// `??` cannot stand in here: a variable never mentioned takes the derivation, where `BARE` is a theme saying
// "no colour" and has to survive it.
const said = (value: StatedInk | undefined, fallback: Ink): Ink =>
  value === undefined ? fallback : value === BARE ? undefined : value;

// One variable of the theme's, as it states it or else as the fallback derives it.
const speaker = (stated: StatedVariables) => (name: InkName, fallback: Ink = undefined): Ink => said(stated[name], fallback);

const derived = (ink: Ink, change: (rgb: RGB) => RGB): Ink => {
  if (ink === undefined) return undefined;
  const rgb = colourValue(ink);
  return rgb === undefined ? undefined : formatHex(change(rgb));
};

interface PieSeeds {
  readonly primaryColor: Ink;
  readonly secondaryColor: Ink;
  readonly tertiaryColor: Ink;
  readonly textColor: Ink;
  readonly taskTextDarkColor: Ink;
}

// `theme-base.js`: each seat is one of the three fills turned, the title and legend on `taskTextDarkColor`.
const PIE_TURNS: ReadonlyArray<readonly [seed: keyof PieSeeds, turn: Turn]> = [
  ["primaryColor", {}], ["secondaryColor", {}], ["tertiaryColor", {}],
  ["primaryColor", { l: -10 }], ["secondaryColor", { l: -10 }], ["tertiaryColor", { l: -10 }],
  ["primaryColor", { h: 60, l: -10 }], ["primaryColor", { h: -60, l: -10 }], ["primaryColor", { h: 120, l: 0 }],
  ["primaryColor", { h: 60, l: -20 }], ["primaryColor", { h: -60, l: -20 }], ["primaryColor", { h: 120, l: -10 }],
];

function derivePie(stated: StatedVariables, seeds: PieSeeds): PieVariables {
  const say = speaker(stated);
  const seat = (at: number): Ink => {
    const [seed, turn] = PIE_TURNS[at];
    return turn.h === undefined && turn.l === undefined ? seeds[seed] : derived(seeds[seed], (c) => adjust(c, turn));
  };
  return {
    pie1: say("pie1", seat(0)),
    pie2: say("pie2", seat(1)),
    pie3: say("pie3", seat(2)),
    pie4: say("pie4", seat(3)),
    pie5: say("pie5", seat(4)),
    pie6: say("pie6", seat(5)),
    pie7: say("pie7", seat(6)),
    pie8: say("pie8", seat(7)),
    pie9: say("pie9", seat(8)),
    pie10: say("pie10", seat(9)),
    pie11: say("pie11", seat(10)),
    pie12: say("pie12", seat(11)),
    pieTitleTextColor: say("pieTitleTextColor", seeds.taskTextDarkColor),
    pieSectionTextColor: say("pieSectionTextColor", seeds.textColor),
    pieLegendTextColor: say("pieLegendTextColor", seeds.taskTextDarkColor),
  };
}

interface GanttSeeds {
  readonly primaryColor: Ink;
  readonly tertiaryColor: Ink;
  readonly primaryBorderColor: Ink;
  readonly textColor: Ink;
}

// `theme-base.js`: the sections off the tertiary and primary fills, the rims off the primary ones.
function deriveGantt(stated: StatedVariables, seeds: GanttSeeds): GanttVariables {
  const say = speaker(stated);
  return {
    sectionBkgColor: say("sectionBkgColor", seeds.tertiaryColor),
    altSectionBkgColor: say("altSectionBkgColor", WHITE),
    sectionBkgColor2: say("sectionBkgColor2", seeds.primaryColor),
    excludeBkgColor: say("excludeBkgColor", EXCLUDE_GREY),
    taskBorderColor: say("taskBorderColor", seeds.primaryBorderColor),
    activeTaskBorderColor: say("activeTaskBorderColor", seeds.primaryColor),
    doneTaskBorderColor: say("doneTaskBorderColor", GREY),
    critBorderColor: say("critBorderColor", CRIT_BORDER),
    taskTextColor: say("taskTextColor", seeds.textColor),
    taskTextOutsideColor: say("taskTextOutsideColor", seeds.textColor),
    taskTextDarkColor: say("taskTextDarkColor", seeds.textColor),
    taskTextClickableColor: say("taskTextClickableColor", CLICKABLE_BLUE),
  };
}

// Every mermaid theme file: an architecture edge 3 wide, a group's frame 2px.
const ARCH_EDGE_WIDTH = "3";
const ARCH_GROUP_BORDER_WIDTH = "2px";

const QUADRANT_STEP = 5;

// `theme-default.js` and its siblings. The point's own derivation yields an invalid `hsl(…, NaN%)` in every theme,
// which the browser drops for the SVG's `textColor`: that is the point mermaid draws until one is written.
function deriveQuadrant(stated: StatedVariables, primaryColor: Ink, primaryTextColor: Ink, primaryBorderColor: Ink, textColor: Ink): QuadrantVariables {
  const say = speaker(stated);
  const step = (seed: Ink, steps: number): Ink => derived(seed, (c) => shiftChannels(c, steps * QUADRANT_STEP));
  return {
    quadrant1Fill: say("quadrant1Fill", primaryColor),
    quadrant2Fill: say("quadrant2Fill", step(primaryColor, 1)),
    quadrant3Fill: say("quadrant3Fill", step(primaryColor, 2)),
    quadrant4Fill: say("quadrant4Fill", step(primaryColor, 3)),
    quadrant1TextFill: say("quadrant1TextFill", primaryTextColor),
    quadrant2TextFill: say("quadrant2TextFill", step(primaryTextColor, -1)),
    quadrant3TextFill: say("quadrant3TextFill", step(primaryTextColor, -2)),
    quadrant4TextFill: say("quadrant4TextFill", step(primaryTextColor, -3)),
    quadrantPointFill: say("quadrantPointFill", textColor),
    quadrantPointTextFill: say("quadrantPointTextFill", primaryTextColor),
    quadrantXAxisTextFill: say("quadrantXAxisTextFill", primaryTextColor),
    quadrantYAxisTextFill: say("quadrantYAxisTextFill", primaryTextColor),
    quadrantInternalBorderStrokeFill: say("quadrantInternalBorderStrokeFill", primaryBorderColor),
    quadrantExternalBorderStrokeFill: say("quadrantExternalBorderStrokeFill", primaryBorderColor),
    quadrantTitleFill: say("quadrantTitleFill", primaryTextColor),
  };
}

const FILL_TURN = 64;

function deriveJourney(stated: StatedVariables, primaryColor: Ink, secondaryColor: Ink): JourneyVariables {
  const say = speaker(stated);
  const turned = (seed: Ink, turns: number): Ink => derived(seed, (c) => adjust(c, { h: turns * FILL_TURN }));
  return {
    fillType0: say("fillType0", primaryColor),
    fillType1: say("fillType1", secondaryColor),
    fillType2: say("fillType2", turned(primaryColor, 1)),
    fillType3: say("fillType3", turned(secondaryColor, 1)),
    fillType4: say("fillType4", turned(primaryColor, -1)),
    fillType5: say("fillType5", turned(secondaryColor, -1)),
    fillType6: say("fillType6", turned(primaryColor, 2)),
    fillType7: say("fillType7", turned(secondaryColor, 2)),
  };
}

const GIT_SHADE = 25;

const BRANCH_LABEL_DARK = "black";

interface GitSeeds {
  readonly darkMode: boolean;
  readonly primaryColor: Ink;
  readonly secondaryColor: Ink;
  readonly tertiaryColor: Ink;
  readonly primaryBorderColor: Ink;
  readonly primaryTextColor: Ink;
  readonly secondaryTextColor: Ink;
  readonly labelTextColor: Ink;
}

// `theme-base.js`: the seats past the three fills, the primary one turned.
const GIT_TURNS: readonly number[] = [-30, -60, -90, 60, 120];

// `theme-base.js`: every seat, a written one too, shaded 25 toward the page's far side before its inverse is taken
// off it; the written seat alone is laid back over the shade.
function deriveGit(stated: StatedVariables, seeds: GitSeeds): GitRootVariables & GitVariables & Pick<ThemeVariables, "branchLabelColor"> {
  const say = speaker(stated);
  const shade = (ink: Ink): Ink => derived(ink, (c) => (seeds.darkMode ? lighten(c, GIT_SHADE) : darken(c, GIT_SHADE)));
  const turned = GIT_TURNS.map((h) => derived(seeds.primaryColor, (c) => adjust(c, { h })));
  const shaded = [seeds.primaryColor, seeds.secondaryColor, seeds.tertiaryColor, ...turned].map((seed, at) =>
    shade(say(GIT_SEAT_NAMES[at], seed))
  );
  const seat = (at: number): Ink => say(GIT_SEAT_NAMES[at], shaded[at]);
  const inverse = (at: number): Ink => say(GIT_INV_NAMES[at], derived(shaded[at], invert));
  const branchLabelColor = say("branchLabelColor", seeds.darkMode ? BRANCH_LABEL_DARK : seeds.labelTextColor);
  const label = (at: number): Ink => say(GIT_LABEL_NAMES[at], branchLabelColor);
  return {
    git0: seat(0), git1: seat(1), git2: seat(2), git3: seat(3), git4: seat(4), git5: seat(5), git6: seat(6), git7: seat(7),
    gitInv0: inverse(0), gitInv1: inverse(1), gitInv2: inverse(2), gitInv3: inverse(3),
    gitInv4: inverse(4), gitInv5: inverse(5), gitInv6: inverse(6), gitInv7: inverse(7),
    branchLabelColor,
    gitBranchLabel0: label(0), gitBranchLabel1: label(1), gitBranchLabel2: label(2), gitBranchLabel3: label(3),
    gitBranchLabel4: label(4), gitBranchLabel5: label(5), gitBranchLabel6: label(6), gitBranchLabel7: label(7),
    commitLineColor: say("commitLineColor"),
    commitLabelColor: say("commitLabelColor", seeds.secondaryTextColor),
    commitLabelBackground: say("commitLabelBackground", seeds.secondaryColor),
    tagLabelColor: say("tagLabelColor", seeds.primaryTextColor),
    tagLabelBackground: say("tagLabelBackground", seeds.primaryColor),
    tagBorder: say("tagBorder"),
    // `theme-base.js` reads `tagBorder` here, never a written `tagLabelBorder`, which is laid back after.
    tagLabelBorder: say("tagLabelBorder", say("tagBorder", seeds.primaryBorderColor)),
  };
}

export function derive(stated: StatedVariables): ThemeVariables {
  const say = speaker(stated);
  // `theme-base.js` in its own order, each step off the ones before it.
  const darkMode = stated.darkMode ?? false;
  const background = say("background");
  const primaryColor = say("primaryColor");
  const primaryTextColor = say("primaryTextColor", darkMode ? DARK_TEXT : LIGHT_TEXT);
  const secondaryColor = say("secondaryColor", derived(primaryColor, (c) => adjust(c, { h: SECONDARY_TURN })));
  const tertiaryColor =
    say("tertiaryColor", derived(primaryColor, (c) => adjust(c, { h: TERTIARY_TURN, l: TERTIARY_LIFT })));
  const border = (ink: Ink): Ink => derived(ink, (c) => mkBorder(c, darkMode));
  const primaryBorderColor = say("primaryBorderColor", border(primaryColor));
  const secondaryBorderColor = say("secondaryBorderColor", border(secondaryColor));
  const tertiaryBorderColor = say("tertiaryBorderColor", border(tertiaryColor));
  const secondaryTextColor = say("secondaryTextColor", derived(secondaryColor, invert));
  const tertiaryTextColor = say("tertiaryTextColor", derived(tertiaryColor, invert));
  const lineColor = say("lineColor", derived(background, invert));
  const textColor = say("textColor", primaryTextColor);
  const mainBkg = say("mainBkg", primaryColor);
  const nodeBorder = say("nodeBorder", primaryBorderColor);
  // `theme-base.js`: `actorBorder || primaryBorderColor`, a written `nodeBorder` leaving the participant alone.
  const actorBorder = say("actorBorder", primaryBorderColor);
  const actorBkg = say("actorBkg", mainBkg);
  // mermaid's sequence chain, `getThemeVariables` in `theme-base.js`: the signals fall back on the page's text, the
  // label box on the participant's own fill and stroke, and every other text on the participant's.
  const actorTextColor = say("actorTextColor", primaryTextColor);
  const noteBkgColor = say("noteBkgColor", NOTE_SLAB);
  const scaleStep = darkMode ? SCALE_DARKEN_DARK : SCALE_DARKEN_LIGHT;
  // `theme-base.js` adjusts in HSL and darkens after: a lightness pushed past white keeps its hue for the darkening.
  const seat = (seed: Ink, turn: Turn): Ink =>
    derived(seed, (c) => {
      const { h, s, l } = toHsl(turn.h === undefined ? c : adjust(c, { h: turn.h }));
      return fromHsl({ h, s, l: Math.max(0, Math.min(PERCENT, l + (turn.l ?? 0)) - scaleStep) });
    });
  const scaleSeeds: readonly Ink[] = [
    seat(primaryColor, {}),
    seat(secondaryColor, {}),
    seat(tertiaryColor, {}),
    ...SCALE_TURNS.map((turn) => seat(primaryColor, turn)),
  ];
  const cScale = Array.from({ length: SECTION_SEATS }, (_, i) => stated.cScale?.[i] ?? scaleSeeds[i] ?? DEFAULT_SECTION_COLORS[i]);
  // `theme-base.js`: every label a source leaves unwritten falls back on `scaleLabelColor`.
  const scaleLabel = said(stated.scaleLabelColor, undefined);
  const cScaleLabel = scaleLabel === undefined ? (stated.cScaleLabel ?? []) : cScale.map((_, at) => stated.cScaleLabel?.[at] ?? scaleLabel);
  const stateBkg = say("stateBkg", mainBkg);
  const gantt = deriveGantt(stated, { primaryColor, tertiaryColor, primaryBorderColor, textColor });
  const row = (dark: number, light: number): Ink => derived(mainBkg, (c) => (darkMode ? darken(c, dark) : lighten(c, light)));
  const generic = { nodeBorder, lineColor, primaryTextColor, textColor, primaryBorderColor };
  const own = (name: FallingInk): Ink => say(name, generic[OWN_FALLBACKS[name]]);
  return {
    darkMode,
    background,
    primaryColor,
    primaryBorderColor,
    primaryTextColor,
    secondaryColor,
    tertiaryColor,
    secondaryBorderColor,
    tertiaryBorderColor,
    secondaryTextColor,
    tertiaryTextColor,
    lineColor,
    arrowheadColor: say("arrowheadColor", derived(background, invert)),
    textColor,
    mainBkg,
    rowOdd: say("rowOdd", row(ROW_ODD_DARK, ROW_ODD_LIGHT)),
    rowEven: say("rowEven", row(ROW_EVEN_DARK, ROW_EVEN_LIGHT)),
    nodeBorder,
    clusterBkg: say("clusterBkg", tertiaryColor),
    clusterBorder: say("clusterBorder", tertiaryBorderColor),
    // `theme-base.js`: a composite state is not a cluster, and falls back on the node's own stroke.
    compositeBorder: say("compositeBorder", nodeBorder),
    // `theme-base.js`: `compositeTitleBackground = compositeTitleBackground || mainBkg`, the band the name stands on
    // taking a box's own fill and not the cluster's.
    compositeTitleBackground: say("compositeTitleBackground", mainBkg),
    // `theme-base.js`: the body under the divider, `compositeBackground || background || tertiaryColor`, and one
    // nested a level down in `altBackground`, which each theme file sets or leaves to `tertiaryColor`. mermaid never
    // leaves `background` unset, and a theme that names none here stands on the terminal's page, the same ground.
    compositeBackground: say("compositeBackground", background),
    altBackground: say("altBackground", tertiaryColor),
    titleColor: say("titleColor", tertiaryTextColor),
    edgeLabelBackground:
      say("edgeLabelBackground", darkMode ? derived(secondaryColor, (c) => darken(c, EDGE_LABEL_DARKEN)) : secondaryColor),
    noteBkgColor,
    noteTextColor: say("noteTextColor", LIGHT_TEXT),
    noteBorderColor: say("noteBorderColor", border(noteBkgColor)),
    gridColor: say("gridColor", LIGHT_GREY),
    taskBkgColor: say("taskBkgColor", primaryColor),
    activeTaskBkgColor:
      say("activeTaskBkgColor", derived(primaryColor, (c) => lighten(c, ACTIVE_LIGHTEN))),
    doneTaskBkgColor: say("doneTaskBkgColor", LIGHT_GREY),
    critBkgColor: say("critBkgColor", RED),
    todayLineColor: say("todayLineColor", RED),
    vertLineColor: say("vertLineColor", NAVY),
    activationBkgColor: say("activationBkgColor", secondaryColor),
    activationBorderColor: say("activationBorderColor", derived(secondaryColor, (c) => darken(c, ACTIVATION_DARKEN))),
    actorBorder,
    actorBkg,
    actorLineColor: say("actorLineColor", actorBorder),
    actorTextColor,
    signalColor: say("signalColor", textColor),
    signalTextColor: say("signalTextColor", textColor),
    labelBoxBkgColor: say("labelBoxBkgColor", actorBkg),
    labelBoxBorderColor: say("labelBoxBorderColor", actorBorder),
    labelTextColor: say("labelTextColor", actorTextColor),
    loopTextColor: say("loopTextColor", actorTextColor),
    sequenceNumberColor: say("sequenceNumberColor", derived(lineColor, invert)),
    borderColorArray: stated.borderColorArray ?? undefined,
    bkgColorArray: stated.bkgColorArray ?? undefined,
    cScale,
    cScalePeer: cScale.map((c, at) => stated.cScalePeer?.[at] ?? derived(c, (rgb) => (darkMode ? lighten(rgb, PEER_STEP) : darken(rgb, PEER_STEP))) ?? c),
    cScaleInv: cScale.map((c, at) => stated.cScaleInv?.[at] ?? derived(c, invert) ?? c),
    cScaleLabel,
    scaleLabelColor: scaleLabel,
    m2t_edgeLabelColor: say("m2t_edgeLabelColor", textColor),
    nodeTextColor: say("nodeTextColor", primaryTextColor),
    classText: say("classText", textColor),
    erEdgeLabelBackground: say("erEdgeLabelBackground"),
    rectBkgColor: say("rectBkgColor", tertiaryColor),
    archEdgeColor: own("archEdgeColor"),
    archEdgeArrowColor: own("archEdgeArrowColor"),
    archGroupBorderColor: own("archGroupBorderColor"),
    archEdgeWidth: say("archEdgeWidth", ARCH_EDGE_WIDTH),
    archGroupBorderWidth: say("archGroupBorderWidth", ARCH_GROUP_BORDER_WIDTH),
    stateBkg,
    labelBackgroundColor: say("labelBackgroundColor", stateBkg),
    stateBorder: own("stateBorder"),
    // `theme-default.js` and its siblings: the label falls back on `primaryTextColor` (`stateBkg` is still unset when
    // it is read), the special marks on the line, the end disc on the node's stroke.
    stateLabelColor: say("stateLabelColor", generic[OWN_FALLBACKS.stateLabelColor] ?? textColor),
    transitionColor: own("transitionColor"),
    transitionLabelColor: own("transitionLabelColor"),
    specialStateColor: own("specialStateColor"),
    innerEndBackground: own("innerEndBackground"),
    m2t_faintColor: say("m2t_faintColor"),
    // `theme-base.js` runs from the primary border to the secondary one; every other theme file states its own pair.
    useGradient: stated.useGradient ?? false,
    gradientStart: say("gradientStart", primaryBorderColor),
    gradientStop: say("gradientStop", secondaryBorderColor),
    ...derivePie(stated, { primaryColor, secondaryColor, tertiaryColor, textColor, taskTextDarkColor: gantt.taskTextDarkColor }),
    ...deriveGit(stated, {
      darkMode, primaryColor, secondaryColor, tertiaryColor, primaryBorderColor, primaryTextColor, secondaryTextColor,
      labelTextColor: say("labelTextColor", actorTextColor),
    }),
    ...gantt,
    ...deriveQuadrant(stated, primaryColor, primaryTextColor, primaryBorderColor, textColor),
    ...deriveJourney(stated, primaryColor, secondaryColor),
    plotColorPalette: say("plotColorPalette", BASE_PLOT_PALETTE),
    xyTitleColor: say("xyTitleColor"),
    xyDataLabelColor: say("xyDataLabelColor"),
    xyLegendTextColor: say("xyLegendTextColor"),
    xyXAxisTitleColor: say("xyXAxisTitleColor"),
    xyXAxisLabelColor: say("xyXAxisLabelColor"),
    xyXAxisTickColor: say("xyXAxisTickColor"),
    xyXAxisLineColor: say("xyXAxisLineColor"),
    xyYAxisTitleColor: say("xyYAxisTitleColor"),
    xyYAxisLabelColor: say("xyYAxisLabelColor"),
    xyYAxisTickColor: say("xyYAxisTickColor"),
    xyYAxisLineColor: say("xyYAxisLineColor"),
    packetLabelColor: say("packetLabelColor"),
    packetTitleColor: say("packetTitleColor"),
  };
}

export const CSS_COLOURS = ["actorBorder", "actorBkg", "actorLineColor", "activationBkgColor", "activationBorderColor"] as const;

// A mermaid theme replays its own theme file over what the source writes and states all it derived, a variable the
// file leaves unset left bare; a palette of this page's own is derived off what it states, as it always was.
export function makeTheme(source: ThemeSource): Theme {
  const replay = replayed(source.name, source.variables);
  const stated = replay ?? source.variables;
  const v = derive(replay === undefined ? stated : { ...leftUnset(replay), ...replay });
  const w = { ...DEFAULT_WEIGHTS, ...source.weights };
  const ink = (seat: ThemeInk): string => {
    const drawn = INK_SOURCES[seat];
    return drawn === undefined ? NO_STYLE : inked(w[drawn.weight], v[drawn.variable]);
  };
  return {
    name: source.name,
    node: ink("node"),
    edge: ink("edge"),
    arrow: ink("arrow"),
    subgraph: ink("subgraph"),
    composite: ink("composite"),
    label: ink("label"),
    edgeLabel: ink("edgeLabel"),
    subgraphLabel: ink("subgraphLabel"),
    default: ink("default"),
    sectionColors: v.cScale,
    variables: v,
    weights: w,
    frameOpacity: source.frameOpacity ?? FRAME_OPACITY,
    lifelineWidth: source.lifelineWidth ?? LIFELINE_WIDTH,
    stated,
    namedLabels: source.namedLabels ?? new Set(),
    written: source.written ?? new Set(),
    ...markerOf(source.marker),
  };
}
