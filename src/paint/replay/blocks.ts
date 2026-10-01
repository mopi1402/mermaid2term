import { SECTION_SEATS } from "../theme-model.js";
import { adjust, darken, invert, lighten, or, shifted, type Bag, type Name, type Paint } from "./tone.js";

// The runs of lines mermaid's theme files share, each in the order every file that holds it writes it.

export type Turn = Parameters<typeof adjust>[1];

export const SEATS: readonly number[] = Array.from({ length: SECTION_SEATS }, (_, at) => at);

export const GIT_SEATS: readonly number[] = Array.from({ length: 8 }, (_, at) => at);

export const BLACK = "#000000";

export const WHITE = "#FFFFFF";

const GIT_SHADE = 25;

// `cScale0` to `cScale11`: the three fills, then the primary one turned by each step.
export function scaleSeeds(v: Bag, seeds: readonly [Paint | undefined, Paint | undefined, Paint | undefined], turns: readonly Turn[]): void {
  const [primary, secondary, tertiary] = seeds;
  or(v, "cScale0", primary);
  or(v, "cScale1", secondary);
  or(v, "cScale2", tertiary);
  turns.forEach((turn, at) => or(v, `cScale${at + seeds.length}`, adjust(primary, turn)));
}

// Every band, a written one too, stepped darker: the written one is laid back over it after.
export const scaleDarkened = (v: Bag, by: number): void => {
  for (const at of SEATS) v[`cScale${at}`] = darken(v[`cScale${at}`], by);
};

export const scaleInverses = (v: Bag): void => {
  for (const at of SEATS) or(v, `cScaleInv${at}`, invert(v[`cScale${at}`]));
};

const PEER_STEP = 10;

export const scalePeers = (v: Bag, lighter: boolean): void => {
  for (const at of SEATS) {
    const band = v[`cScale${at}`];
    or(v, `cScalePeer${at}`, lighter ? lighten(band, PEER_STEP) : darken(band, PEER_STEP));
  }
};

export const scaleLabels = (v: Bag): void => {
  for (const at of SEATS) or(v, `cScaleLabel${at}`, v.scaleLabelColor);
};

// A theme file's lines in its order: `[name, from]` is its plain `this.name = this.from` or `= from(this)`, a function
// any other line or run of lines.
export type Step = readonly [name: Name, from: Name | ((v: Bag) => Paint | undefined)] | ((v: Bag) => void);

export function play(v: Bag, steps: readonly Step[]): void {
  for (const step of steps) {
    if (typeof step === "function") step(v);
    else {
      const [name, from] = step;
      v[name] = typeof from === "function" ? from(v) : v[from];
    }
  }
}

// mermaid's `this.x = this.x || value` or its plain `this.x = value`, for a run a file writes either way.
export type Assign = (v: Bag, name: Name, value: Paint | undefined) => void;

export const pin: Assign = (v, name, value) => {
  v[name] = value;
};

const FILL_TURN = 64;

// A journey's fills: the primary and secondary colours turned 64 degrees by turns.
export function fillTypes(v: Bag, primary: Paint | undefined, secondary: Paint | undefined, assign: Assign): void {
  assign(v, "fillType0", primary);
  assign(v, "fillType1", secondary);
  [1, -1, 2].forEach((turns, at) => {
    assign(v, `fillType${2 * at + 2}`, adjust(primary, { h: turns * FILL_TURN }));
    assign(v, `fillType${2 * at + 3}`, adjust(secondary, { h: turns * FILL_TURN }));
  });
}

export type PieTurn = readonly [seed: 0 | 1 | 2, turn: Turn];

// `pie1` to `pie12`, each one of the three fills as it stands or turned.
export function pieTurns(v: Bag, seeds: readonly [Paint | undefined, Paint | undefined, Paint | undefined], turns: readonly PieTurn[]): void {
  turns.forEach(([seed, turn], at) => or(v, `pie${at + 1}`, turn.h === undefined && turn.l === undefined ? seeds[seed] : adjust(seeds[seed], turn)));
}

export function pieTexts(v: Bag, title: Paint | undefined, section: Paint | undefined): void {
  or(v, "pieTitleTextColor", title);
  or(v, "pieSectionTextColor", section);
  or(v, "pieLegendTextColor", title);
}

const QUADRANT_STEP = 5;

// The point's own line reads `isDark(...) ? lighten(...) : darken(...)` with no amount, an invalid `hsl()` the browser
// drops: it is left to the SVG's text colour, as `derive` does.
export function quadrants(v: Bag, primary: Paint | undefined): void {
  or(v, "quadrant1Fill", primary);
  or(v, "quadrant2Fill", shifted(primary, QUADRANT_STEP));
  or(v, "quadrant3Fill", shifted(primary, 2 * QUADRANT_STEP));
  or(v, "quadrant4Fill", shifted(primary, 3 * QUADRANT_STEP));
  or(v, "quadrant1TextFill", v.primaryTextColor);
  or(v, "quadrant2TextFill", shifted(v.primaryTextColor, -QUADRANT_STEP));
  or(v, "quadrant3TextFill", shifted(v.primaryTextColor, -2 * QUADRANT_STEP));
  or(v, "quadrant4TextFill", shifted(v.primaryTextColor, -3 * QUADRANT_STEP));
  or(v, "quadrantPointTextFill", v.primaryTextColor);
  or(v, "quadrantXAxisTextFill", v.primaryTextColor);
  or(v, "quadrantYAxisTextFill", v.primaryTextColor);
  or(v, "quadrantInternalBorderStrokeFill", v.primaryBorderColor);
  or(v, "quadrantExternalBorderStrokeFill", v.primaryBorderColor);
  or(v, "quadrantTitleFill", v.primaryTextColor);
}

// The state diagram's run, `stateLabelColor` read before `stateBkg` is set.
export function states(v: Bag, transition: Paint | undefined): void {
  or(v, "transitionColor", transition);
  or(v, "transitionLabelColor", v.textColor);
  or(v, "stateLabelColor", v.stateBkg || v.primaryTextColor);
  or(v, "stateBkg", v.mainBkg);
  or(v, "labelBackgroundColor", v.stateBkg);
}

interface Composite {
  readonly back?: Paint | undefined;
  readonly alt: Paint | undefined;
  readonly title?: Paint | undefined;
  readonly bordered: boolean;
  readonly innerEnd: Paint | undefined;
  readonly special: Paint | undefined;
}

export function composites(v: Bag, own: Composite): void {
  or(v, "compositeBackground", own.back ?? (v.background || v.tertiaryColor));
  or(v, "altBackground", own.alt);
  or(v, "compositeTitleBackground", own.title ?? v.mainBkg);
  if (own.bordered) or(v, "compositeBorder", v.nodeBorder);
  v.innerEndBackground = own.innerEnd;
  v.specialStateColor = own.special;
}

const GIT_TURNS: readonly number[] = [-30, -60, -90, 60, 120];

// The eight git seats off the three fills, the primary one turned past them.
export const gitTurned = (primary: Paint | undefined, secondary: Paint | undefined, tertiary: Paint | undefined): Array<Paint | undefined> => [
  primary, secondary, tertiary, ...GIT_TURNS.map((h) => adjust(primary, { h })),
];

export const gitSeeds = (v: Bag, seeds: ReadonlyArray<Paint | undefined>, assign: Assign = or): void => {
  seeds.forEach((seed, at) => assign(v, `git${at}`, seed));
};

// Every seat, a written one too, 25 toward the page's far side: the written one is laid back over it after.
export const gitShaded = (v: Bag, lighter: boolean): void => {
  for (const at of GIT_SEATS) v[`git${at}`] = lighter ? lighten(v[`git${at}`], GIT_SHADE) : darken(v[`git${at}`], GIT_SHADE);
};

export const gitInverses = (v: Bag, from = 0): void => {
  for (const at of GIT_SEATS.slice(from)) or(v, `gitInv${at}`, invert(v[`git${at}`]));
};

export function branchLabels(v: Bag): void {
  or(v, "branchLabelColor", v.darkMode === true ? BLACK : v.labelTextColor);
  for (const at of GIT_SEATS) or(v, `gitBranchLabel${at}`, v.branchLabelColor);
}

// `theme-dark.js`, `theme-default.js`, `theme-forest.js`: seats 0 and 3 in the inverse of the label ink.
const INVERSE_LABELS: ReadonlySet<number> = new Set([0, 3]);
export function invertedBranchLabels(v: Bag): void {
  for (const at of GIT_SEATS) or(v, `gitBranchLabel${at}`, INVERSE_LABELS.has(at) ? invert(v.labelTextColor) : v.labelTextColor);
}

// The tags read `tagBorder`, never a `tagLabelBorder` of their own, which only the written one lays back.
export function tags(v: Bag): void {
  or(v, "tagLabelColor", v.primaryTextColor);
  or(v, "tagLabelBackground", v.primaryColor);
  v.tagLabelBorder = v.tagBorder || v.primaryBorderColor;
  or(v, "commitLabelColor", v.secondaryTextColor);
  or(v, "commitLabelBackground", v.secondaryColor);
}
