import {
  DOUBLE,
  HEAVY,
  LIGHT,
  NONE,
  ARMS_BY_GLYPH,
  GLYPH_BY_ARMS,
  mapArms,
  plain,
  weightedGlyph,
  type Arms,
  type Weight,
} from "./arms.js";

export const ARC = {
  topLeft: "\u256d",
  topRight: "\u256e",
  bottomLeft: "\u2570",
  bottomRight: "\u256f",
} as const;
export const ARCS: ReadonlySet<string> = new Set(Object.values(ARC));

// The quadrant arcs curve in the CELL's own corner, where `╭╮╰╯` curve on its midlines. A padless box runs its
// rules along the cell edges, so these four are the only ones that read as a corner there.
export const QUADRANT_ARC = {
  topLeft: "\u25dc",
  topRight: "\u25dd",
  bottomLeft: "\u25df",
  bottomRight: "\u25de",
} as const;
const ARC_ARMS: ReadonlyMap<string, Arms> = new Map([
  [ARC.topLeft, [NONE, LIGHT, NONE, LIGHT]],
  [ARC.topRight, [LIGHT, NONE, NONE, LIGHT]],
  [ARC.bottomLeft, [NONE, LIGHT, LIGHT, NONE]],
  [ARC.bottomRight, [LIGHT, NONE, LIGHT, NONE]],
]);

export const DASH = {
  across: {
    light: { double: "\u254c", triple: "\u2504", quadruple: "\u2508" },
    heavy: { double: "\u254d", triple: "\u2505", quadruple: "\u2509" },
  },
  down: {
    light: { double: "\u254e", triple: "\u2506", quadruple: "\u250a" },
    heavy: { double: "\u254f", triple: "\u2507", quadruple: "\u250b" },
  },
} as const;
const DASH_ARMS: ReadonlyMap<string, Arms> = new Map([
  ...Object.values(DASH.across.light).map((g): [string, Arms] => [g, [LIGHT, LIGHT, NONE, NONE]]),
  ...Object.values(DASH.across.heavy).map((g): [string, Arms] => [g, [HEAVY, HEAVY, NONE, NONE]]),
  ...Object.values(DASH.down.light).map((g): [string, Arms] => [g, [NONE, NONE, LIGHT, LIGHT]]),
  ...Object.values(DASH.down.heavy).map((g): [string, Arms] => [g, [NONE, NONE, HEAVY, HEAVY]]),
]);
export const DASHED_HORIZONTAL: readonly string[] = [...Object.values(DASH.across.light), ...Object.values(DASH.across.heavy)];
export const DASHED_VERTICAL: readonly string[] = [...Object.values(DASH.down.light), ...Object.values(DASH.down.heavy)];

export function armsOf(glyph: string): Arms | undefined {
  return ARMS_BY_GLYPH.get(glyph) ?? ARC_ARMS.get(glyph) ?? DASH_ARMS.get(glyph) ?? undefined;
}

// jscpd:ignore-start: a flat glyph table matches itself one row down once identifiers are ignored
export const BOX = {
  across: plain(LIGHT, LIGHT, NONE, NONE),
  down: plain(NONE, NONE, LIGHT, LIGHT),
  heavyAcross: plain(HEAVY, HEAVY, NONE, NONE),
  heavyDown: plain(NONE, NONE, HEAVY, HEAVY),
  doubleAcross: plain(DOUBLE, DOUBLE, NONE, NONE),
  doubleDown: plain(NONE, NONE, DOUBLE, DOUBLE),
  topLeft: plain(NONE, LIGHT, NONE, LIGHT),
  topRight: plain(LIGHT, NONE, NONE, LIGHT),
  bottomLeft: plain(NONE, LIGHT, LIGHT, NONE),
  bottomRight: plain(LIGHT, NONE, LIGHT, NONE),
  heavyTopLeft: plain(NONE, HEAVY, NONE, HEAVY),
  heavyTopRight: plain(HEAVY, NONE, NONE, HEAVY),
  heavyBottomLeft: plain(NONE, HEAVY, HEAVY, NONE),
  heavyBottomRight: plain(HEAVY, NONE, HEAVY, NONE),
  doubleTopLeft: plain(NONE, DOUBLE, NONE, DOUBLE),
  doubleTopRight: plain(DOUBLE, NONE, NONE, DOUBLE),
  doubleBottomLeft: plain(NONE, DOUBLE, DOUBLE, NONE),
  doubleBottomRight: plain(DOUBLE, NONE, DOUBLE, NONE),
  teeRight: plain(NONE, LIGHT, LIGHT, LIGHT),
  teeLeft: plain(LIGHT, NONE, LIGHT, LIGHT),
  teeDown: plain(LIGHT, LIGHT, NONE, LIGHT),
  teeUp: plain(LIGHT, LIGHT, LIGHT, NONE),
  cross: plain(LIGHT, LIGHT, LIGHT, LIGHT),
  halfLeft: plain(LIGHT, NONE, NONE, NONE),
  halfUp: plain(NONE, NONE, LIGHT, NONE),
  heavyHalfLeft: plain(HEAVY, NONE, NONE, NONE),
  heavyHalfUp: plain(NONE, NONE, HEAVY, NONE),
  lightUpHeavyDown: plain(NONE, NONE, LIGHT, HEAVY),
  heavyUpLightDown: plain(NONE, NONE, HEAVY, LIGHT),
} as const;
// jscpd:ignore-end

export const BLOCK = {
  full: "\u2588",
  lightShade: "\u2591",
  mediumShade: "\u2592",
  darkShade: "\u2593",
  upperHalf: "\u2580",
  lowerHalf: "\u2584",
  leftHalf: "\u258c",
  rightHalf: "\u2590",
  lowerQuarter: "\u2582",
  lowerThreeEighths: "\u2583",
  lowerFiveEighths: "\u2585",
  lowerThreeQuarters: "\u2586",
  leftQuarter: "\u258e",
  lowerEighth: "\u2581",
  lowerSevenEighths: "\u2587",
  upperEighth: "\u2594",
  leftEighth: "\u258f",
  leftThreeEighths: "\u258d",
  leftFiveEighths: "\u258b",
  leftThreeQuarters: "\u258a",
  leftSevenEighths: "\u2589",
  rightEighth: "\u2595",
  upperLeft: "\u2598",
  upperRight: "\u259d",
  lowerLeft: "\u2596",
  lowerRight: "\u2597",
  fallingPair: "\u259a",
  risingPair: "\u259e",
  lessUpperLeft: "\u259f",
  lessUpperRight: "\u2599",
  lessLowerLeft: "\u259c",
  lessLowerRight: "\u259b",
} as const;

// A cell inked from the bottom by one to seven eighths, the top of a vertical bar.
export const LOWER_EIGHTHS: readonly string[] = [
  BLOCK.lowerEighth, BLOCK.lowerQuarter, BLOCK.lowerThreeEighths, BLOCK.lowerHalf, BLOCK.lowerFiveEighths, BLOCK.lowerThreeQuarters, BLOCK.lowerSevenEighths,
];

// A cell inked from the left by one to seven eighths, the end of a horizontal bar.
export const LEFT_EIGHTHS: readonly string[] = [
  BLOCK.leftEighth, BLOCK.leftQuarter, BLOCK.leftThreeEighths, BLOCK.leftHalf, BLOCK.leftFiveEighths, BLOCK.leftThreeQuarters, BLOCK.leftSevenEighths,
];

export const ACROSS_STROKES: ReadonlySet<string> = new Set([BOX.across, BOX.heavyAcross, ...DASHED_HORIZONTAL, BOX.halfLeft, BOX.heavyHalfLeft]);
export const DOWN_STROKES: ReadonlySet<string> = new Set([BOX.down, BOX.heavyDown, ...DASHED_VERTICAL, BOX.halfUp, BOX.heavyHalfUp]);
export const ACROSS_RUNS: ReadonlySet<string> = new Set([...ACROSS_STROKES, BOX.doubleAcross]);
export const DOWN_RUNS: ReadonlySet<string> = new Set([...DOWN_STROKES, BOX.doubleDown]);
export const SOLID_ACROSS: ReadonlySet<string> = new Set([BOX.across, BOX.heavyAcross, BOX.doubleAcross]);
export const CROSSINGS: ReadonlySet<string> = new Set(
  [...GLYPH_BY_ARMS].filter(([key]) => [...key].every((w) => w === String(LIGHT) || w === String(HEAVY))).map(([, glyph]) => glyph)
);

const raise = (weight: Weight): Weight => (weight === LIGHT ? HEAVY : weight);
const fullAcross = (arms: Arms): boolean => arms[0] !== NONE && arms[1] !== NONE;
const fullDown = (arms: Arms): boolean => arms[2] !== NONE && arms[3] !== NONE;

// A tee on a wall keeps the arm a link leaves by; a corner, `whole`, is the frame's on every arm.
export function heavier(glyph: string, corner = false): string | undefined {
  const arms = ARMS_BY_GLYPH.get(glyph);
  if (arms === undefined) return undefined;
  const across = fullAcross(arms);
  const down = fullDown(arms);
  const whole = corner || (!across && !down);
  const along = [across || whole, across || whole, down || whole, down || whole];
  return weightedGlyph(mapArms(arms, (w, i) => (along[i] ? raise(w) : w)));
}

function stubArm(arms: Arms): number | undefined {
  const across = fullAcross(arms);
  const down = fullDown(arms);
  if (across === down) return undefined;
  const candidates = across ? [2, 3] : [0, 1];
  const arm = candidates.filter((i) => arms[i] !== NONE);
  return arm.length === 1 ? (arm[0]) : undefined;
}

export function thickStub(glyph: string): string | undefined {
  const arms = ARMS_BY_GLYPH.get(glyph);
  if (arms === undefined) return undefined;
  const stub = stubArm(arms);
  if (stub === undefined) return undefined;
  return weightedGlyph(mapArms(arms, (w, i) => (i === stub ? raise(w) : w)));
}

const SIDES = ["left", "right", "up", "down"] as const;
export type Side = (typeof SIDES)[number];
export function stubOf(glyph: string): readonly [Side, string] | undefined {
  const arms = ARMS_BY_GLYPH.get(glyph);
  if (arms === undefined) return undefined;
  const stub = stubArm(arms);
  if (stub === undefined) return undefined;
  const weight = arms[stub];
  const stroke = stub < 2 ? weightedGlyph([weight, weight, NONE, NONE]) : weightedGlyph([NONE, NONE, weight, weight]);
  return stroke === undefined ? undefined : [SIDES[stub], stroke];
}

export function quadrantInside(corner: string): string | undefined {
  const arms = armsOf(corner);
  if (arms === undefined) return undefined;
  const [l, r, u, d] = arms;
  if ((l !== NONE) === (r !== NONE) || (u !== NONE) === (d !== NONE)) return undefined;
  return d !== NONE ? (r !== NONE ? BLOCK.lowerRight : BLOCK.lowerLeft) : r !== NONE ? BLOCK.upperRight : BLOCK.upperLeft;
}

