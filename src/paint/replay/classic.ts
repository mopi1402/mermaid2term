import {
  BLACK, composites, fillTypes, GIT_SEATS, gitInverses, gitSeeds, gitShaded, gitTurned, invertedBranchLabels, pieTexts, pieTurns, pin, play, quadrants,
  scaleInverses, scaleLabels, scalePeers, scaleSeeds, SEATS, states, tags, WHITE, type PieTurn, type Step, type Turn,
} from "./blocks.js";
import { adjust, CALCULATED, darken, invert, lighten, or, type Bag, type Paint } from "./tone.js";

// The `updateColors` of `theme-dark.js`, `theme-default.js`, `theme-forest.js` and `theme-neutral.js`, each its own,
// most of it pinned over what the source writes and only laid back after.

// Seat 8 turned 210 degrees and no further, unlike `theme-base.js`.
const SCALE_TURNS: readonly Turn[] = [{ h: 30 }, { h: 60 }, { h: 90 }, { h: 120 }, { h: 150 }, { h: 210 }, { h: 270 }, { h: 300 }, { h: 330 }];

const DARK_SCALE: readonly string[] = ["#0B0000", "#4D1037", "#3F5258", "#4F2F1B", "#6E0A0A", "#3B0048", "#995A01", "#154706", "#161722", "#00296F", "#01629C"];

const DARK_PLOT_PALETTE = "#3498db,#2ecc71,#e74c3c,#f1c40f,#bdc3c7,#ffffff,#34495e,#9b59b6,#1abc9c,#e67e22";

const SECOND_BKG_LIGHTEN = 16;
const EDGE_LABEL_LIGHTEN = 25;
const TASK_LIGHTEN = 23;
const GIT_LIGHTEN = 20;
const GIT_LIGHTEN_LESS = 10;
const GIT_LIFTS: readonly number[] = [GIT_LIGHTEN, GIT_LIGHTEN, GIT_LIGHTEN, GIT_LIGHTEN, GIT_LIGHTEN, GIT_LIGHTEN_LESS, GIT_LIGHTEN_LESS, GIT_LIGHTEN];

const rect: Step = (v) => or(v, "rectBkgColor", v.tertiaryColor);

const archOnLine: readonly Step[] = [["archEdgeColor", "lineColor"], ["archEdgeArrowColor", "lineColor"]];

// Seat 0 off the secondary colour, every other off the pie seat after its own, lightened.
function darkGit(v: Bag): void {
  const [, secondary, tertiary, ...turned] = gitTurned(v.primaryColor, v.secondaryColor, v.tertiaryColor);
  const seeds: Array<Paint | undefined> = [secondary, v.pie2 || secondary, v.pie3 || tertiary, ...turned.map((seed, at) => v[`pie${at + 4}`] || seed)];
  gitSeeds(v, seeds.map((seed, at) => lighten(seed, GIT_LIFTS[at])), pin);
}

const DARK: readonly Step[] = [
  ["secondBkg", (v) => lighten(v.mainBkg, SECOND_BKG_LIGHTEN)],
  ["lineColor", "mainContrastColor"],
  ["arrowheadColor", "mainContrastColor"],
  ["nodeBorder", "border1"],
  ["clusterBkg", "secondBkg"],
  ["clusterBorder", "border2"],
  ["edgeLabelBackground", (v) => lighten(v.labelBackground, EDGE_LABEL_LIGHTEN)],
  ["actorBorder", "border1"],
  ["actorBkg", "mainBkg"],
  ["actorTextColor", "mainContrastColor"],
  ["actorLineColor", "actorBorder"],
  ["signalColor", "mainContrastColor"],
  ["signalTextColor", "mainContrastColor"],
  ["labelBoxBkgColor", "actorBkg"],
  ["labelBoxBorderColor", "actorBorder"],
  ["labelTextColor", "mainContrastColor"],
  ["loopTextColor", "mainContrastColor"],
  ["noteBorderColor", "secondaryBorderColor"],
  ["noteBkgColor", "secondBkg"],
  ["noteTextColor", "secondaryTextColor"],
  ["activationBorderColor", "border1"],
  ["activationBkgColor", "secondBkg"],
  rect,
  ["altSectionBkgColor", "background"],
  ["taskBkgColor", (v) => lighten(v.mainBkg, TASK_LIGHTEN)],
  ["taskTextColor", "darkTextColor"],
  ["taskTextLightColor", "mainContrastColor"],
  ["taskTextOutsideColor", "taskTextLightColor"],
  ["gridColor", "mainContrastColor"],
  ["doneTaskBkgColor", "mainContrastColor"],
  ["taskTextDarkColor", (v) => invert(v.doneTaskBkgColor)],
  ...archOnLine,
  (v) => states(v, v.lineColor),
  (v) => composites(v, { alt: "#555555", bordered: true, innerEnd: v.primaryBorderColor, special: "#F4F4F4" }),
  (v) => fillTypes(v, v.primaryColor, v.secondaryColor, pin),
  (v) => DARK_SCALE.forEach((band, at) => or(v, `cScale${at + 1}`, band)),
  (v) => or(v, "cScale0", v.primaryColor),
  scaleInverses,
  (v) => scalePeers(v, true),
  (v) => or(v, "scaleLabelColor", v.darkMode === true ? BLACK : v.labelTextColor),
  scaleLabels,
  (v) => SEATS.forEach((at) => (v[`pie${at}`] = v[`cScale${at}`])),
  (v) => pieTexts(v, v.mainContrastColor, v.textColor),
  (v) => quadrants(v, v.primaryColor),
  (v) => or(v, "plotColorPalette", DARK_PLOT_PALETTE),
  ["classText", "primaryTextColor"],
  darkGit,
  (v) => gitInverses(v),
  invertedBranchLabels,
  tags,
];

const CLASSIC_PEER_1 = 45;
const CLASSIC_PEER_2 = 40;
const CLASSIC_DARKEN = 10;
const CLASSIC_PEER = 25;
const INVERSE_TURN = 180;

// `theme-default.js` and `theme-forest.js`: the bands darkened once, their peers and inverses off the darkened band.
function classicScale(v: Bag): void {
  scaleSeeds(v, [v.primaryColor, v.secondaryColor, v.tertiaryColor], SCALE_TURNS);
  or(v, "cScalePeer1", darken(v.secondaryColor, CLASSIC_PEER_1));
  or(v, "cScalePeer2", darken(v.tertiaryColor, CLASSIC_PEER_2));
  for (const at of SEATS) {
    v[`cScale${at}`] = darken(v[`cScale${at}`], CLASSIC_DARKEN);
    or(v, `cScalePeer${at}`, darken(v[`cScale${at}`], CLASSIC_PEER));
  }
  for (const at of SEATS) or(v, `cScaleInv${at}`, adjust(v[`cScale${at}`], { h: INVERSE_TURN }));
  v.scaleLabelColor = v.scaleLabelColor !== CALCULATED && v.scaleLabelColor ? v.scaleLabelColor : v.labelTextColor;
}

interface ClassicRest {
  readonly rows: Paint | undefined;
  readonly evenLift: number;
  readonly innerEnd: Paint | undefined;
  readonly pie: readonly PieTurn[];
  readonly palette: string;
}

const ROW_ODD = 75;
const ALT_GROUND = "#F0F0F0";

// `theme-default.js` and `theme-forest.js` from their ER rows on: the state run, the composites, their pie turns, the
// quadrant, the plot palette and the git seats.
function classicRest(v: Bag, { rows, evenLift, innerEnd, pie, palette }: ClassicRest): void {
  or(v, "rowOdd", lighten(rows, ROW_ODD));
  or(v, "rowEven", lighten(rows, evenLift));
  states(v, v.lineColor);
  composites(v, { alt: ALT_GROUND, bordered: true, innerEnd, special: v.lineColor });
  v.classText = v.primaryTextColor;
  fillTypes(v, v.primaryColor, v.secondaryColor, pin);
  pieTurns(v, [v.primaryColor, v.secondaryColor, v.tertiaryColor], pie);
  pieTexts(v, v.taskTextDarkColor, v.textColor);
  quadrants(v, v.primaryColor);
  or(v, "plotColorPalette", palette);
  gitSeeds(v, gitTurned(v.primaryColor, v.secondaryColor, v.tertiaryColor));
  gitShaded(v, v.darkMode === true);
}

const DEFAULT_PIE: readonly PieTurn[] = [
  [0, {}], [1, {}], [2, { l: -40 }], [0, { l: -10 }], [1, { l: -30 }], [2, { l: -20 }],
  [0, { h: 60, l: -20 }], [0, { h: -60, l: -40 }], [0, { h: 120, l: -40 }],
  [0, { h: 60, l: -40 }], [0, { h: -90, l: -40 }], [0, { h: 120, l: -30 }],
];

const DEFAULT_PLOT_PALETTE = "#ECECFF,#8493A6,#FFC3A0,#DCDDE1,#B8E994,#D1A36F,#C3CDE6,#FFB6C1,#496078,#F8F3E3";

const DEFAULT_ROW_EVEN = 1;
const FIRST_INVERSE_DARKEN = 25;

const DEFAULT: readonly Step[] = [
  classicScale,
  (v) => {
    if (v.labelTextColor === CALCULATED) return;
    or(v, "cScaleLabel0", invert(v.labelTextColor));
    or(v, "cScaleLabel3", invert(v.labelTextColor));
    for (const at of SEATS) or(v, `cScaleLabel${at}`, v.labelTextColor);
  },
  ["nodeBorder", "border1"],
  ["clusterBkg", "secondBkg"],
  ["clusterBorder", "border2"],
  ["titleColor", "textColor"],
  ["edgeLabelBackground", "labelBackground"],
  ["actorBorder", "border1"],
  ["actorBkg", "mainBkg"],
  ["labelBoxBkgColor", "actorBkg"],
  ["signalColor", "textColor"],
  ["signalTextColor", "textColor"],
  ["labelBoxBorderColor", "actorBorder"],
  ["labelTextColor", "actorTextColor"],
  ["loopTextColor", "actorTextColor"],
  ["noteBorderColor", "border2"],
  ["noteTextColor", "actorTextColor"],
  ["actorLineColor", "actorBorder"],
  rect,
  ["taskTextColor", "taskTextLightColor"],
  ["taskTextOutsideColor", "taskTextDarkColor"],
  ...archOnLine,
  (v) => classicRest(v, { rows: v.primaryColor, evenLift: DEFAULT_ROW_EVEN, innerEnd: v.nodeBorder, pie: DEFAULT_PIE, palette: DEFAULT_PLOT_PALETTE }),
  (v) => or(v, "gitInv0", darken(invert(v.git0), FIRST_INVERSE_DARKEN)),
  (v) => gitInverses(v, 1),
  invertedBranchLabels,
  tags,
];

const FOREST_PIE: readonly PieTurn[] = [
  [0, {}], [1, {}], [2, {}], [0, { l: -30 }], [1, { l: -30 }], [2, { h: 40, l: -40 }],
  [0, { h: 60, l: -10 }], [0, { h: -60, l: -10 }], [0, { h: 120, l: 0 }],
  [0, { h: 60, l: -50 }], [0, { h: -60, l: -50 }], [0, { h: 120, l: -50 }],
];

const FOREST_PLOT_PALETTE = "#CDE498,#FF6B6B,#A0D2DB,#D7BDE2,#F0F0F0,#FFC3A0,#7FD8BE,#FF9A8B,#FAF3E0,#FFF176";

const ACTOR_DARKEN = 20;
const FOREST_ROW_EVEN = 20;

const FOREST: readonly Step[] = [
  ["actorBorder", (v) => darken(v.mainBkg, ACTOR_DARKEN)],
  ["actorBkg", "mainBkg"],
  ["labelBoxBkgColor", "actorBkg"],
  ["labelTextColor", "actorTextColor"],
  ["loopTextColor", "actorTextColor"],
  ["noteBorderColor", "border2"],
  ["noteTextColor", "actorTextColor"],
  ["actorLineColor", "actorBorder"],
  rect,
  classicScale,
  scaleLabels,
  ["nodeBorder", "border1"],
  ["clusterBkg", "secondBkg"],
  ["clusterBorder", "border2"],
  ["taskBorderColor", "border1"],
  ["taskTextColor", "taskTextLightColor"],
  ["taskTextOutsideColor", "taskTextDarkColor"],
  ["activeTaskBorderColor", "taskBorderColor"],
  ["activeTaskBkgColor", "mainBkg"],
  ...archOnLine,
  (v) => classicRest(v, { rows: v.mainBkg, evenLift: FOREST_ROW_EVEN, innerEnd: v.primaryBorderColor, pie: FOREST_PIE, palette: FOREST_PLOT_PALETTE }),
  (v) => gitInverses(v),
  invertedBranchLabels,
  tags,
];

const NEUTRAL_SCALE: readonly string[] = ["#555555", "#F4F4F4", "#555555", "#BBBBBB", "#777777", "#999999", "#DDDDDD", "#FFFFFF", "#DDDDDD", "#BBBBBB", "#999999", "#777777"];

const NEUTRAL_PLOT_PALETTE = "#EEE,#6BB8E4,#8ACB88,#C7ACD6,#E8DCC2,#FFB2A8,#FFF380,#7E8D91,#FFD8B1,#FAF3E0";

const SECOND_BKG_STEP = 55;
const SECTION_LIGHTEN = 30;
const NEUTRAL_ACTOR_LIGHTEN = 23;
const GRID_LIGHTEN = 30;
const GIT_ROOT_DARKEN = 25;
// `theme-neutral.js` labels seats 1 and 3 white, whatever `branchLabelColor` says.
const WHITE_LABELS: ReadonlySet<number> = new Set([1, 3]);

// Seat 0 off the first pie seat darkened, every other off the pie seat after its own.
function neutralGit(v: Bag): void {
  const seeds = gitTurned(v.primaryColor, v.secondaryColor, v.tertiaryColor);
  gitSeeds(v, seeds.map((seed, at) => (at === 0 ? darken(v.pie1, GIT_ROOT_DARKEN) : v[`pie${at + 1}`]) || seed), pin);
  gitInverses(v);
  or(v, "branchLabelColor", v.labelTextColor);
  for (const at of GIT_SEATS) v[`gitBranchLabel${at}`] = WHITE_LABELS.has(at) ? WHITE : v.branchLabelColor;
}

const NEUTRAL: readonly Step[] = [
  ["secondBkg", (v) => lighten(v.contrast, SECOND_BKG_STEP)],
  ["border2", "contrast"],
  ["actorBorder", (v) => lighten(v.border1, NEUTRAL_ACTOR_LIGHTEN)],
  ["actorBkg", "mainBkg"],
  ["actorTextColor", "text"],
  ["actorLineColor", "actorBorder"],
  rect,
  ["signalColor", "text"],
  ["signalTextColor", "text"],
  ["labelBoxBkgColor", "actorBkg"],
  ["labelBoxBorderColor", "actorBorder"],
  ["labelTextColor", "text"],
  ["loopTextColor", "text"],
  ["noteBorderColor", () => "#999999"],
  ["noteBkgColor", () => "#666666"],
  ["noteTextColor", () => WHITE],
  (v) => NEUTRAL_SCALE.forEach((band, at) => or(v, `cScale${at}`, band)),
  scaleInverses,
  (v) => scalePeers(v, v.darkMode === true),
  (v) => or(v, "scaleLabelColor", v.darkMode === true ? BLACK : v.labelTextColor),
  (v) => or(v, "cScaleLabel0", v.cScale1),
  (v) => or(v, "cScaleLabel2", v.cScale1),
  scaleLabels,
  ["nodeBorder", "border1"],
  ["clusterBkg", "secondBkg"],
  ["clusterBorder", "border2"],
  ["titleColor", "text"],
  ["sectionBkgColor", (v) => lighten(v.contrast, SECTION_LIGHTEN)],
  ["sectionBkgColor2", (v) => lighten(v.contrast, SECTION_LIGHTEN)],
  ["taskBorderColor", (v) => darken(v.contrast, CLASSIC_DARKEN)],
  ["taskBkgColor", "contrast"],
  ["taskTextColor", "taskTextLightColor"],
  ["taskTextDarkColor", "text"],
  ["taskTextOutsideColor", "taskTextDarkColor"],
  ["activeTaskBorderColor", "taskBorderColor"],
  ["activeTaskBkgColor", "mainBkg"],
  ["gridColor", (v) => lighten(v.border1, GRID_LIGHTEN)],
  ["doneTaskBkgColor", "done"],
  ["doneTaskBorderColor", "lineColor"],
  ["critBkgColor", "critical"],
  ["critBorderColor", (v) => darken(v.critBkgColor, CLASSIC_DARKEN)],
  ["todayLineColor", "critBkgColor"],
  ["vertLineColor", "critBkgColor"],
  ...archOnLine,
  (v) => states(v, BLACK),
  (v) => composites(v, { alt: "#F4F4F4", bordered: false, innerEnd: v.primaryBorderColor, special: "#222222" }),
  (v) => or(v, "stateBorder", BLACK),
  ["classText", "primaryTextColor"],
  (v) => fillTypes(v, v.primaryColor, v.secondaryColor, pin),
  (v) => SEATS.forEach((at) => (v[`pie${at}`] = v[`cScale${at}`])),
  ["pie12", "pie0"],
  (v) => pieTexts(v, v.taskTextDarkColor, v.textColor),
  (v) => quadrants(v, v.primaryColor),
  (v) => or(v, "plotColorPalette", NEUTRAL_PLOT_PALETTE),
  neutralGit,
  tags,
];

export const CLASSIC_PROGRAMS: ReadonlyMap<string, (v: Bag) => void> = new Map(
  ([["dark", DARK], ["default", DEFAULT], ["forest", FOREST], ["neutral", NEUTRAL]] as const).map(([name, steps]) => [name, (v: Bag): void => play(v, steps)])
);
