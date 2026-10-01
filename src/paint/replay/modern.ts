import {
  BLACK, branchLabels, composites, fillTypes, gitInverses, gitSeeds, gitShaded, gitTurned, pieTexts, pieTurns, quadrants,
  scaleDarkened, scaleInverses, scaleLabels, scalePeers, scaleSeeds, SEATS, states, tags, WHITE, type PieTurn, type Turn,
} from "./blocks.js";
import { adjust, CALCULATED, darken, invert, isDark, lighten, mkBorder, or, type Bag, type Paint } from "./tone.js";

// `theme-base.js`'s `updateColors` and the six files written off it, `theme-neo*.js` and the `theme-redux*.js` packs,
// each a family of the same lines in the same order, told apart below.

export const LIGHT_GREY = "#D3D3D3";
export const GREY = "#808080";
export const RED = "#FF0000";
export const NAVY = "#000080";
export const CRIT_BORDER = "#FF8888";
export const EXCLUDE_GREY = "#EEEEEE";
export const CLICKABLE_BLUE = "#003163";
export const NOTE_SLAB = "#FFF5AD";
export const LIGHT_TEXT = "#333333";
export const DARK_TEXT = "#EEEEEE";

export const BASE_PLOT_PALETTE = "#FFF4DD,#FFD8B1,#FFA07A,#ECEFF1,#D6DBDF,#C3E0A8,#FFB6A4,#FFD74D,#738FA7,#FFFFF0";

// Seat 8 takes `l: 150` too, which clamps to white before the band is darkened, its hue kept for the darkening.
const SCALE_TURNS: readonly Turn[] = [{ h: 30 }, { h: 60 }, { h: 90 }, { h: 120 }, { h: 150 }, { h: 210, l: 150 }, { h: 270 }, { h: 300 }, { h: 330 }];

const PIE_TURNS: readonly PieTurn[] = [
  [0, {}], [1, {}], [2, {}], [0, { l: -10 }], [1, { l: -10 }], [2, { l: -10 }],
  [0, { h: 60, l: -10 }], [0, { h: -60, l: -10 }], [0, { h: 120, l: 0 }],
  [0, { h: 60, l: -20 }], [0, { h: -60, l: -20 }], [0, { h: 120, l: -10 }],
];

const SECONDARY_TURN = -120;
const TERTIARY_TURN: Turn = { h: 180, l: 5 };
const EDGE_LABEL_DARKEN = 30;
const ACTIVATION_DARKEN = 10;
const ACTIVE_LIGHTEN = 23;
const RECT_STEP = 4;
const SECOND_BKG_LIGHTEN = 16;
const SCALE_DARKEN_DARK = 75;
const SCALE_DARKEN_LIGHT = 25;
const ARCH_EDGE = "#777777";
const ARCH_EDGE_WIDTH = "3";
const ARCH_GROUP_BORDER_WIDTH = "2px";
const ROW_ODD_DARK = 5;
const ROW_EVEN_DARK = 10;
const ROW_ODD_LIGHT = 75;
const ROW_EVEN_LIGHT = 5;
const LABEL_DARKEN = 75;
const NEO_ALT = "#F0F0F0";
const REDUX_LINE = "#BDBCCC";

// `theme-neo.js` and the light redux packs fill their gantt, scale, journey, pie, quadrant and git seats off a pair of
// their own, never the primary colour the source writes.
const NEO_PRIMARY = "#ECECFE";
const NEO_SECONDARY = "#E9E9F1";

// `theme-neo-dark.js`'s git seats, lightened whatever `darkMode` says.
const NEO_DARK_GIT: readonly string[] = ["#0B0000", "#4D1037", "#3F5258", "#4F2F1B", "#6E0A0A", "#3B0048", "#995A01", "#154706"];

// The redux colour packs' bands, and `theme-redux-dark-color.js`'s journey fills.
const PACK_SCALE: readonly string[] = [
  "#F4A8FF", "#46ECD5", "#FFB86A", "#DAB2FF", "#7BF1A8", "#C4B4FF", "#FFA2A2", "#FFDF20", "#A3B3FF", "#BBF451", "#74D4FF", "#FFA1AD",
];
const DARK_PACK_FILLS: readonly string[] = ["#701A75", "#134E4A", "#7C2D12", "#581C87", "#14532D", "#4C1D95", "#7F1D1D", "#713F12"];

type Seeds = readonly [Paint | undefined, Paint | undefined, Paint | undefined];

interface Family {
  readonly text: string;
  readonly noteBkg: string;
  readonly noteText: string;
  // `theme-base.js` alone: ER rows, its own architecture inks, a navy `vertLineColor`, the gradient off the borders.
  readonly base?: boolean;
  // The dark twins' `secondBkg`, off `mainBkg`, and a node stroked `border1`.
  readonly dark?: boolean;
  // `theme-redux-dark*.js` pin the participant's stroke, the signals and the label box's rim.
  readonly pinsActors?: boolean;
  // `theme-neo.js` and the light redux packs: a `rect` a shade off the page, the section seeds a pair of their own.
  readonly own?: boolean;
  // The redux packs' composite grounds, pinned or fallen back on: nothing after reads them, so either comes to this.
  readonly composite?: { readonly back?: string; readonly ground: string };
  readonly scale?: "page" | "pack";
  readonly git?: "neo-dark";
  readonly redux?: { readonly erEdge: string; readonly darkPack?: boolean };
}

function primaries(v: Bag, family: Family): void {
  const dark = v.darkMode === true;
  or(v, "primaryTextColor", dark ? DARK_TEXT : family.text);
  or(v, "secondaryColor", adjust(v.primaryColor, { h: SECONDARY_TURN }));
  or(v, "tertiaryColor", adjust(v.primaryColor, TERTIARY_TURN));
  or(v, "primaryBorderColor", mkBorder(v.primaryColor, dark));
  or(v, "secondaryBorderColor", mkBorder(v.secondaryColor, dark));
  or(v, "tertiaryBorderColor", mkBorder(v.tertiaryColor, dark));
  or(v, "noteBorderColor", mkBorder(v.noteBkgColor, dark));
  or(v, "noteBkgColor", family.noteBkg);
  or(v, "noteTextColor", family.noteText);
  or(v, "secondaryTextColor", invert(v.secondaryColor));
  or(v, "tertiaryTextColor", invert(v.tertiaryColor));
  or(v, "lineColor", invert(v.background));
  or(v, "arrowheadColor", invert(v.background));
  or(v, "textColor", v.primaryTextColor);
  or(v, "mainBkg", v.primaryColor);
  if (family.dark === true) {
    v.secondBkg = v.secondBkg === CALCULATED ? lighten(v.mainBkg, SECOND_BKG_LIGHTEN) : v.secondBkg;
    or(v, "nodeBorder", v.border1);
  } else {
    or(v, "nodeBorder", v.primaryBorderColor);
  }
  or(v, "clusterBkg", v.tertiaryColor);
  or(v, "clusterBorder", v.tertiaryBorderColor);
  or(v, "titleColor", v.tertiaryTextColor);
  or(v, "edgeLabelBackground", dark ? darken(v.secondaryColor, EDGE_LABEL_DARKEN) : v.secondaryColor);
  or(v, "nodeTextColor", v.primaryTextColor);
}

function sequence(v: Bag, family: Family): void {
  if (family.pinsActors === true) {
    v.actorBorder = WHITE;
    v.signalColor = WHITE;
    v.labelBoxBorderColor = REDUX_LINE;
  }
  or(v, "actorBorder", v.primaryBorderColor);
  or(v, "actorBkg", v.mainBkg);
  or(v, "actorTextColor", v.primaryTextColor);
  or(v, "actorLineColor", v.actorBorder);
  or(v, "labelBoxBkgColor", v.actorBkg);
  or(v, "signalColor", v.textColor);
  or(v, "signalTextColor", v.textColor);
  or(v, "labelBoxBorderColor", v.actorBorder);
  or(v, "labelTextColor", v.actorTextColor);
  or(v, "loopTextColor", v.actorTextColor);
  or(v, "activationBorderColor", darken(v.secondaryColor, ACTIVATION_DARKEN));
  or(v, "activationBkgColor", v.secondaryColor);
  or(v, "sequenceNumberColor", invert(v.lineColor));
  const page = v.background;
  or(v, "rectBkgColor", family.own === true ? (isDark(page) ? lighten(page, RECT_STEP) : darken(page, RECT_STEP)) : v.tertiaryColor);
}

function sections(v: Bag, [primary, secondary, tertiary]: Seeds, alternate: Paint | undefined): void {
  or(v, "sectionBkgColor", tertiary);
  or(v, "altSectionBkgColor", alternate);
  or(v, "sectionBkgColor", secondary);
  or(v, "sectionBkgColor2", primary);
}

function tasks(v: Bag, family: Family, primary: Paint | undefined): void {
  or(v, "excludeBkgColor", EXCLUDE_GREY);
  or(v, "taskBorderColor", v.primaryBorderColor);
  or(v, "taskBkgColor", primary);
  or(v, "activeTaskBorderColor", primary);
  or(v, "activeTaskBkgColor", lighten(primary, ACTIVE_LIGHTEN));
  or(v, "gridColor", LIGHT_GREY);
  or(v, "doneTaskBkgColor", family.dark === true ? v.secondBkg : LIGHT_GREY);
  or(v, "doneTaskBorderColor", GREY);
  or(v, "critBorderColor", CRIT_BORDER);
  or(v, "critBkgColor", RED);
  or(v, "todayLineColor", RED);
  or(v, "vertLineColor", family.base === true ? NAVY : v.primaryBorderColor);
  or(v, "taskTextColor", v.textColor);
  or(v, "taskTextOutsideColor", v.textColor);
  or(v, "taskTextLightColor", v.textColor);
  or(v, "taskTextColor", v.primaryTextColor);
  or(v, "taskTextDarkColor", v.textColor);
  or(v, "taskTextClickableColor", CLICKABLE_BLUE);
}

function rows(v: Bag): void {
  const dark = v.darkMode === true;
  or(v, "rowOdd", dark ? darken(v.mainBkg, ROW_ODD_DARK) : lighten(v.mainBkg, ROW_ODD_LIGHT));
  or(v, "rowEven", dark ? darken(v.mainBkg, ROW_EVEN_DARK) : lighten(v.mainBkg, ROW_EVEN_LIGHT));
}

function scale(v: Bag, family: Family, seeds: Seeds): void {
  if (family.scale === "pack") {
    PACK_SCALE.forEach((band, at) => or(v, `cScale${at}`, band));
    or(v, "sectionBkgColor", v.cScale0);
    or(v, "sectionBkgColor2", v.cScale1);
    or(v, "altSectionBkgColor", family.redux?.darkPack === true ? v.background : WHITE);
  } else {
    if (family.scale === "page") for (const at of SEATS) v[`cScale${at}`] = v.mainBkg;
    else scaleSeeds(v, seeds, SCALE_TURNS);
    scaleDarkened(v, v.darkMode === true ? SCALE_DARKEN_DARK : SCALE_DARKEN_LIGHT);
  }
  scaleInverses(v);
  scalePeers(v, v.darkMode === true);
  or(v, "scaleLabelColor", v.labelTextColor);
  if (family.redux?.darkPack === true) for (const at of SEATS) v[`cScaleLabel${at}`] = darken(v[`cScale${at}`], LABEL_DARKEN);
  else scaleLabels(v);
}

function fills(v: Bag, family: Family, [primary, secondary, tertiary]: Seeds): void {
  or(v, "classText", v.textColor);
  if (family.scale === "pack") {
    const journey = family.redux?.darkPack === true ? DARK_PACK_FILLS : (v.bkgColorArray ?? []);
    journey.slice(0, DARK_PACK_FILLS.length).forEach((fill, at) => or(v, `fillType${at}`, fill));
    for (const at of SEATS) or(v, `pie${at + 1}`, v[`cScale${at}`]);
  } else {
    fillTypes(v, primary, secondary, or);
    pieTurns(v, [primary, secondary, tertiary], PIE_TURNS);
  }
  pieTexts(v, v.taskTextDarkColor, family.redux?.darkPack === true ? REDUX_TEXT : v.textColor);
}

function git(v: Bag, family: Family, [primary, secondary, tertiary]: Seeds): void {
  gitSeeds(v, family.git === "neo-dark" ? NEO_DARK_GIT : gitTurned(primary, secondary, tertiary));
  gitShaded(v, family.git === "neo-dark" || v.darkMode === true);
  gitInverses(v);
  branchLabels(v);
  tags(v);
}

function modern(v: Bag, family: Family): void {
  primaries(v, family);
  sequence(v, family);
  const seeds: Seeds = family.own === true
    ? [NEO_PRIMARY, NEO_SECONDARY, adjust(NEO_PRIMARY, TERTIARY_TURN)]
    : [v.primaryColor, v.secondaryColor, v.tertiaryColor];
  if (family.scale !== "pack") sections(v, seeds, WHITE);
  tasks(v, family, seeds[0]);
  if (family.base === true) rows(v);
  else {
    v.archEdgeColor = v.lineColor;
    v.archEdgeArrowColor = v.lineColor;
  }
  states(v, v.lineColor);
  const composite = family.composite;
  composites(v, {
    back: composite?.back,
    alt: family.base === true ? v.tertiaryColor : (composite?.ground ?? NEO_ALT),
    title: composite?.ground,
    bordered: true,
    innerEnd: v.nodeBorder,
    special: v.lineColor,
  });
  scale(v, family, seeds);
  fills(v, family, seeds);
  if (family.base === true) {
    or(v, "archEdgeColor", ARCH_EDGE);
    or(v, "archEdgeArrowColor", ARCH_EDGE);
    or(v, "archEdgeWidth", ARCH_EDGE_WIDTH);
    or(v, "archGroupBorderColor", BLACK);
    or(v, "archGroupBorderWidth", ARCH_GROUP_BORDER_WIDTH);
  }
  quadrants(v, seeds[0]);
  or(v, "plotColorPalette", BASE_PLOT_PALETTE);
  git(v, family, seeds);
  if (family.redux !== undefined) {
    v.commitLineColor ??= REDUX_LINE;
    v.erEdgeLabelBackground = family.redux.erEdge;
  }
  if (family.base === true) {
    v.gradientStart = v.primaryBorderColor;
    v.gradientStop = v.secondaryBorderColor;
  }
}

const REDUX_TEXT = "#28253D";
const REDUX_NOTE = "#FEF9C3";
const REDUX_GROUND = "#F9F9FB";
const REDUX_DARK_GROUND = "#16141F";

const FAMILIES: ReadonlyArray<readonly [name: string, family: Family]> = [
  ["base", { text: LIGHT_TEXT, noteBkg: NOTE_SLAB, noteText: LIGHT_TEXT, base: true }],
  ["neo", { text: LIGHT_TEXT, noteBkg: NOTE_SLAB, noteText: LIGHT_TEXT, own: true }],
  ["neo-dark", { text: LIGHT_TEXT, noteBkg: NOTE_SLAB, noteText: LIGHT_TEXT, dark: true, git: "neo-dark" }],
  ["redux", {
    text: REDUX_TEXT, noteBkg: REDUX_NOTE, noteText: REDUX_TEXT, own: true, composite: { ground: REDUX_GROUND }, scale: "page",
    redux: { erEdge: WHITE },
  }],
  ["redux-dark", {
    text: WHITE, noteBkg: NOTE_SLAB, noteText: WHITE, dark: true, pinsActors: true,
    composite: { back: REDUX_DARK_GROUND, ground: REDUX_DARK_GROUND }, redux: { erEdge: REDUX_DARK_GROUND },
  }],
  ["redux-color", {
    text: REDUX_TEXT, noteBkg: NOTE_SLAB, noteText: REDUX_TEXT, own: true, composite: { ground: REDUX_GROUND }, scale: "pack",
    redux: { erEdge: WHITE },
  }],
  ["redux-dark-color", {
    text: WHITE, noteBkg: NOTE_SLAB, noteText: WHITE, dark: true, pinsActors: true,
    composite: { back: REDUX_DARK_GROUND, ground: REDUX_DARK_GROUND }, scale: "pack", redux: { erEdge: REDUX_DARK_GROUND, darkPack: true },
  }],
];

export const MODERN_PROGRAMS: ReadonlyMap<string, (v: Bag) => void> = new Map(
  FAMILIES.map(([name, family]) => [name, (v: Bag): void => modern(v, family)])
);
