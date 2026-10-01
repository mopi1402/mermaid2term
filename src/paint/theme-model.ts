import { type Restyle } from "./themecss/model.js";
import { type RGB } from "../colour/rgb.js";

export const SCALE_PREFIX = "cScale";

export const SCALE_LABEL_PREFIX = "cScaleLabel";

export const SCALE_PEER_PREFIX = "cScalePeer";

export const SCALE_INV_PREFIX = "cScaleInv";

export const NO_COLOUR = new Set(["null", "none", "transparent"]);

// The seat a count takes on a ring of them, wrapping past its end.
export const seatIn = <T>(ring: readonly T[], at: number): T => ring[at % ring.length];

type SectionColors = readonly string[];

export type Ink = string | undefined;

export const BARE: unique symbol = Symbol("bare");

export type StatedInk = string | typeof BARE;

// A seated list a source writes one seat of, each seat it leaves derived.
type SparseSeats = "cScale" | "cScalePeer" | "cScaleInv";

export type StatedVariables = {
  [K in keyof ThemeVariables]?: K extends SparseSeats ? readonly Ink[] : ThemeVariables[K] extends Ink ? StatedInk : ThemeVariables[K];
};

// mermaid's pie renderer reads its slices' fills off `pie1` to `pie12`, in that order (`pieRenderer.ts`).
export const PIE_SEAT_NAMES = [
  "pie1", "pie2", "pie3", "pie4", "pie5", "pie6", "pie7", "pie8", "pie9", "pie10", "pie11", "pie12",
] as const;

type PieSeat = (typeof PIE_SEAT_NAMES)[number];

export interface PieVariables extends Record<PieSeat, Ink> {
  pieTitleTextColor: Ink;
  pieSectionTextColor: Ink;
  pieLegendTextColor: Ink;
}

// The first git seat, which mermaid's mindmap fills its root with and inks its root's text in (`mindmap/styles.ts`).
export interface GitRootVariables {
  git0: Ink;
  gitBranchLabel0: Ink;
}

// mermaid's eight git seats, read by name as each theme file writes them (`theme-*.js`, `git/styles.js`).
export const GIT_SEAT_NAMES = ["git0", "git1", "git2", "git3", "git4", "git5", "git6", "git7"] as const;
export const GIT_INV_NAMES = ["gitInv0", "gitInv1", "gitInv2", "gitInv3", "gitInv4", "gitInv5", "gitInv6", "gitInv7"] as const;
export const GIT_LABEL_NAMES = [
  "gitBranchLabel0", "gitBranchLabel1", "gitBranchLabel2", "gitBranchLabel3",
  "gitBranchLabel4", "gitBranchLabel5", "gitBranchLabel6", "gitBranchLabel7",
] as const;

type GitSeat = Exclude<(typeof GIT_SEAT_NAMES)[number] | (typeof GIT_LABEL_NAMES)[number], keyof GitRootVariables>;

// `tagBorder` is mermaid's input for a tag's rim, `tagLabelBorder` the rim its stylesheet reads.
export interface GitVariables extends Record<GitSeat | (typeof GIT_INV_NAMES)[number] | "branchLabelColor" | "tagLabelBorder", Ink> {
  commitLineColor: Ink;
  commitLabelColor: Ink;
  commitLabelBackground: Ink;
  tagLabelColor: Ink;
  tagLabelBackground: Ink;
  tagBorder: Ink;
}

// The inks mermaid's gantt stylesheet reads that no other kind does; `taskBkgColor` and the three state fills are shared.
export interface GanttVariables {
  sectionBkgColor: Ink;
  altSectionBkgColor: Ink;
  sectionBkgColor2: Ink;
  taskBorderColor: Ink;
  activeTaskBorderColor: Ink;
  doneTaskBorderColor: Ink;
  critBorderColor: Ink;
  taskTextColor: Ink;
  taskTextOutsideColor: Ink;
  taskTextDarkColor: Ink;
  taskTextClickableColor: Ink;
  excludeBkgColor: Ink;
}

// The quadrant chart's own inks (`theme-default.js` and its siblings): four fills and their texts off the primary
// colour, stepped a few units per channel, the frame and the axes on its border, every text on its text colour.
export interface QuadrantVariables {
  quadrant1Fill: Ink;
  quadrant2Fill: Ink;
  quadrant3Fill: Ink;
  quadrant4Fill: Ink;
  quadrant1TextFill: Ink;
  quadrant2TextFill: Ink;
  quadrant3TextFill: Ink;
  quadrant4TextFill: Ink;
  quadrantPointFill: Ink;
  quadrantPointTextFill: Ink;
  quadrantXAxisTextFill: Ink;
  quadrantYAxisTextFill: Ink;
  quadrantInternalBorderStrokeFill: Ink;
  quadrantExternalBorderStrokeFill: Ink;
  quadrantTitleFill: Ink;
}

// A journey's section and task fills (`theme-default.js`), the primary and secondary colours turned by 64 and 128
// degrees by turns. mermaid 12's themes carry no `actor<N>`, so its `.actor-N` rules are always empty.
export type JourneyVariables = Record<`fillType${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`, Ink>;

// The xychart's plot colours, one per plot in source order, as mermaid's comma list (`xyChart.plotColorPalette`).
// Each text and axis part of it in its own ink, as mermaid reads them from `themeVariables.xyChart` alone, each
// falling back on `primaryTextColor` where unwritten.
interface XyChartVariables {
  plotColorPalette: Ink;
  xyTitleColor: Ink;
  xyDataLabelColor: Ink;
  xyLegendTextColor: Ink;
  xyXAxisTitleColor: Ink;
  xyXAxisLabelColor: Ink;
  xyXAxisTickColor: Ink;
  xyXAxisLineColor: Ink;
  xyYAxisTitleColor: Ink;
  xyYAxisLabelColor: Ink;
  xyYAxisTickColor: Ink;
  xyYAxisLineColor: Ink;
}

// The packet's name and title inks, as mermaid reads them from `themeVariables.packet` alone.
interface PacketVariables {
  packetLabelColor: Ink;
  packetTitleColor: Ink;
}

// A flowchart subgraph's frame and a composite state's, with the ground an edge's label stands on.
interface ClusterVariables {
  clusterBkg: Ink;
  clusterBorder: Ink;
  compositeBorder: Ink;
  compositeTitleBackground: Ink;
  compositeBackground: Ink;
  altBackground: Ink;
  titleColor: Ink;
  edgeLabelBackground: Ink;
}

// A note's slab, its words and its rim.
interface NoteVariables {
  noteBkgColor: Ink;
  noteTextColor: Ink;
  noteBorderColor: Ink;
}

// The sequence diagram's activations, participants, messages, label boxes and loops (`theme-base.js`).
interface SequenceVariables {
  activationBkgColor: Ink;
  activationBorderColor: Ink;
  actorBorder: Ink;
  actorBkg: Ink;
  actorLineColor: Ink;
  actorTextColor: Ink;
  signalColor: Ink;
  signalTextColor: Ink;
  labelBoxBkgColor: Ink;
  labelBoxBorderColor: Ink;
  labelTextColor: Ink;
  loopTextColor: Ink;
  sequenceNumberColor: Ink;
}

// The steps `theme-base.js` derives the others through, which a source may write as well.
interface IntermediateVariables {
  secondaryBorderColor: Ink;
  tertiaryBorderColor: Ink;
  secondaryTextColor: Ink;
  tertiaryTextColor: Ink;
  labelBackgroundColor: Ink;
  branchLabelColor: Ink;
  // Every `cScaleLabel<N>` a theme file leaves unwritten falls back on it, in the files that read it at all.
  scaleLabelColor: Ink;
}

export interface ThemeVariables
  extends PieVariables, GitRootVariables, GitVariables, GanttVariables, QuadrantVariables, JourneyVariables, XyChartVariables, PacketVariables,
    ClusterVariables, NoteVariables, SequenceVariables, IntermediateVariables {
  darkMode: boolean;
  background: Ink;
  primaryColor: Ink;
  primaryBorderColor: Ink;
  primaryTextColor: Ink;
  secondaryColor: Ink;
  tertiaryColor: Ink;
  lineColor: Ink;
  arrowheadColor: Ink;
  textColor: Ink;
  mainBkg: Ink;
  rowOdd: Ink;
  rowEven: Ink;
  nodeBorder: Ink;
  gridColor: Ink;
  taskBkgColor: Ink;
  activeTaskBkgColor: Ink;
  doneTaskBkgColor: Ink;
  critBkgColor: Ink;
  todayLineColor: Ink;
  vertLineColor: Ink;
  borderColorArray: readonly string[] | undefined;
  bkgColorArray: readonly string[] | undefined;
  cScale: SectionColors;
  // The outline mermaid strokes each `cScale` seat with, a treemap section's.
  cScalePeer: SectionColors;
  cScaleInv: SectionColors;
  cScaleLabel: readonly Ink[];
  // mermaid2term's own ink for the secondary words of the kinds mermaid keys none for (`docs/divergences.md`).
  m2t_edgeLabelColor: Ink;
  // A node's label in the flowchart, ER and block stylesheets, `textColor` when unwritten; a class box's text.
  nodeTextColor: Ink;
  classText: Ink;
  // A relationship label's ground in the ER stylesheet, under `redux-color` and `redux-dark-color` alone.
  erEdgeLabelBackground: Ink;
  // A sequence `rect` written with no colour, `tertiaryColor` in mermaid's themes.
  rectBkgColor: Ink;
  // An architecture edge, its head and a group's frame, the line and the primary border in all but `base`.
  archEdgeColor: Ink;
  archEdgeArrowColor: Ink;
  archGroupBorderColor: Ink;
  archEdgeWidth: Ink;
  archGroupBorderWidth: Ink;
  // The state diagram's own, each read before the generic one it falls back on (`styles.ts` of `stateDiagram`).
  stateBkg: Ink;
  stateBorder: Ink;
  stateLabelColor: Ink;
  transitionColor: Ink;
  transitionLabelColor: Ink;
  specialStateColor: Ink;
  innerEndBackground: Ink;
  m2t_faintColor: Ink;
  // The `neo` look strokes a box with a left-to-right gradient between these two when the theme turns it on.
  useGradient: boolean;
  gradientStart: Ink;
  gradientStop: Ink;
}

export interface ThemeWeights {
  node: string;
  edge: string;
  arrow: string;
  label: string;
  edgeLabel: string;
  subgraph: string;
  subgraphLabel: string;
}

export const DEFAULT_WEIGHTS: ThemeWeights = {
  node: "",
  edge: "",
  arrow: "bold",
  label: "bold",
  edgeLabel: "italic",
  subgraph: "",
  subgraphLabel: "bold",
};

export const THEME_INKS = [
  "node", "edge", "arrow", "subgraph", "composite", "label", "edgeLabel", "subgraphLabel", "default",
] as const;

export type ThemeInk = (typeof THEME_INKS)[number];

// The variables that hold a single ink, as against a flag or a list.
export type InkName = { [K in keyof ThemeVariables]-?: ThemeVariables[K] extends Ink ? K : never }[keyof ThemeVariables];

// A kind's own variable and the generic one it falls back on, in the theme files and the kind's stylesheet alike.
export const OWN_FALLBACKS = {
  stateBorder: "nodeBorder",
  stateLabelColor: "primaryTextColor",
  transitionColor: "lineColor",
  transitionLabelColor: "textColor",
  specialStateColor: "lineColor",
  innerEndBackground: "nodeBorder",
  archEdgeColor: "lineColor",
  archEdgeArrowColor: "lineColor",
  archGroupBorderColor: "primaryBorderColor",
} as const satisfies Partial<Record<InkName, InkName>>;

export type FallingInk = keyof typeof OWN_FALLBACKS;

// The weight each of the theme's own inks wears and the variable it is drawn from.
export const INK_SOURCES: Readonly<Record<ThemeInk, { weight: keyof ThemeWeights; variable: InkName } | undefined>> = {
  node: { weight: "node", variable: "nodeBorder" },
  edge: { weight: "edge", variable: "lineColor" },
  arrow: { weight: "arrow", variable: "arrowheadColor" },
  subgraph: { weight: "subgraph", variable: "clusterBorder" },
  // mermaid's `.statediagram-cluster rect`: `stateBorder || nodeBorder`, `compositeBorder` read by no stylesheet.
  composite: { weight: "subgraph", variable: "stateBorder" },
  label: { weight: "label", variable: "textColor" },
  edgeLabel: { weight: "edgeLabel", variable: "m2t_edgeLabelColor" },
  subgraphLabel: { weight: "subgraphLabel", variable: "titleColor" },
  default: undefined,
};

export interface Theme extends Record<ThemeInk, string> {
  name: string;
  sectionColors: SectionColors;
  variables: ThemeVariables;
  weights: ThemeWeights;
  frameOpacity: number;
  lifelineWidth: number;
  ground?: RGB;
  // The diagram title's ink where a kind gives it one of its own, the label's otherwise.
  heading?: string;
  stated: StatedVariables;
  // The seats whose `cScaleLabel` the source wrote over the theme's own: kept as written, never weighed nor turned.
  namedLabels: ReadonlySet<number>;
  // The variables the source wrote over the theme's own: kept as written when the theme is turned for the other ground.
  written: ReadonlySet<string>;
  // The rules the source's `themeCSS` writes for its kind's own selectors, laid over the palette at paint.
  restyles?: readonly Restyle[];
  // The words an edge chip is written in when a `themeCSS` rule inked the node words apart from them.
  chipLabel?: string;
  // The fills a section's band is laid on where the kind's sheet fills it apart from the ink it strokes it in.
  sectionGrounds?: SectionColors;
  // A themeCSS `.marker` rule's colour, which a flowchart's heads wear over `lineColor`.
  marker?: string;
}

// The ink a themeCSS `.marker` rule gives the heads, carried apart from `arrowheadColor`, which mermaid's heads never read.
export const markerOf = (marker: string | undefined): { marker?: string } => (marker === undefined ? {} : { marker });

export const DEFAULT_SECTION_COLORS: SectionColors = [
  "#14385C",
  "#5C1424",
  "#145C28",
  "#5C4814",
  "#3C145C",
  "#145C50",
  "#5C2814",
  "#28145C",
  "#385C14",
  "#5C1450",
  "#565C14",
  "#1A5C14",
];

// mermaid's `THEME_COLOR_LIMIT`, the seats every theme file fills `cScale0` to `cScale11` with.
export const SECTION_SEATS = 12;

export const NO_STYLE = "";

export interface ThemeSource {
  name: string;
  variables: StatedVariables;
  weights?: Partial<ThemeWeights>;
  frameOpacity?: number | undefined;
  lifelineWidth?: number;
  namedLabels?: ReadonlySet<number>;
  written?: ReadonlySet<string>;
  marker?: string;
}

export const FRAME_OPACITY = 0.5;

export const LIFELINE_WIDTH = 0.5;

export const HEAVY_LIFELINE = 2;

// mermaid's themes by family, each a light theme and its dark twin: which stylesheet a theme gets is its name's
// (`gitGraphRenderer.ts`, `git/styles.js`, `colorThemeGate`).
type Family = "classic" | "neo" | "redux" | "redux-color";
const FAMILIES: ReadonlyArray<readonly [light: string, dark: string, family: Family]> = [
  ["default", "dark", "classic"],
  ["neo", "neo-dark", "neo"],
  ["redux", "redux-dark", "redux"],
  ["redux-color", "redux-dark-color", "redux-color"],
];
const named = (keep: (family: Family) => boolean): ReadonlySet<string> =>
  new Set(FAMILIES.flatMap(([light, dark, family]) => (keep(family) ? [light, dark] : [])));

export const THEME_TWINS: ReadonlyArray<readonly [light: string, dark: string]> = FAMILIES.map(([light, dark]) => [light, dark]);
export const DARK_THEMES: ReadonlySet<string> = new Set(FAMILIES.map(([, dark]) => dark));
export const NEO_THEMES = named((family) => family === "neo");
export const REDUX_THEMES = named((family) => family === "redux" || family === "redux-color");
// mermaid's `colorThemeGate`: only these two themes stamp a box with a slot of `borderColorArray`.
export const COLOR_THEMES = named((family) => family === "redux-color");
