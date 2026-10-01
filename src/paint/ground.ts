import { DARK_BACKGROUND, LIGHT_BACKGROUND, sideOf, type Background } from "../colour/background.js";
import { PLAIN_RATIO, contrastRatio } from "../colour/contrast.js";
import { unitHsl, unitRgb } from "../colour/hsl.js";
import { BLACK_RGB, WHITE_RGB, formatHex, parseHex, type RGB } from "../colour/rgb.js";
import { mirrorDefinition } from "./sgr.js";
import { must } from "../must.js";
import { DARK_THEMES, INK_SOURCES, markerOf, THEME_INKS, THEME_TWINS, type Theme, type ThemeVariables } from "./theme-model.js";
import { THEMES } from "./catalogue.js";

export type BackgroundOption = Background | string;

export interface Ground {
  readonly rgb: RGB;
  readonly side: Background;
}

const rgbOf = (hex: string | undefined): RGB | undefined => (hex === undefined ? undefined : parseHex(hex.toLowerCase()));

export function groundOf(background: BackgroundOption | undefined): Ground | undefined {
  if (background === undefined) return undefined;
  if (background === DARK_BACKGROUND) return { rgb: BLACK_RGB, side: DARK_BACKGROUND };
  if (background === LIGHT_BACKGROUND) return { rgb: WHITE_RGB, side: LIGHT_BACKGROUND };
  const rgb = parseHex(background.toLowerCase());
  if (rgb === undefined) throw new Error(`background: ${background} is neither a side (light, dark) nor a #rrggbb colour`);
  return { rgb, side: sideOf(rgb) };
}

export const isDarkTwin = (name: string): boolean => DARK_THEMES.has(name);

export const themeFamilies = (): string[] => [...THEMES.keys()].filter((name) => !isDarkTwin(name));

export function themeSide(theme: Theme): Background {
  const rgb = rgbOf(theme.variables.background);
  return rgb === undefined ? DARK_BACKGROUND : sideOf(rgb);
}

export function twinOf(name: string, side: Background): string {
  const theme = THEMES.get(name);
  if (theme === undefined || themeSide(theme) === side) return name;
  for (const [light, dark] of THEME_TWINS) {
    if (name === light && side === DARK_BACKGROUND) return dark;
    if (name === dark && side === LIGHT_BACKGROUND) return light;
  }
  return name;
}

const lightnessOf = (hex: string | undefined): number | undefined => {
  const rgb = rgbOf(hex);
  return rgb === undefined ? undefined : unitHsl(rgb).l;
};

function spaced(fill: string | undefined, stroke: string | undefined, drawn: number | undefined, towards: Background): string | undefined {
  const rgb = rgbOf(fill);
  const strokeL = lightnessOf(stroke);
  if (rgb === undefined || strokeL === undefined || drawn === undefined) return fill;
  const wanted = Math.max(drawn, FILL_GAP);
  const { h, s, l } = unitHsl(rgb);
  if (Math.abs(strokeL - l) >= wanted) return fill;
  const page = towards === DARK_BACKGROUND ? 0 : 1;
  const moved = towards === DARK_BACKGROUND ? strokeL - wanted : strokeL + wanted;
  const clamped = towards === DARK_BACKGROUND ? Math.max(page, moved) : Math.min(page, moved);
  return formatHex(unitRgb(h, s, clamped));
}

const FILL_GAP = 0.14;
const FILL_MAX = 0.14;

function held(fill: string | undefined, towards: Background): string | undefined {
  const rgb = rgbOf(fill);
  if (rgb === undefined) return fill;
  const { h, s, l } = unitHsl(rgb);
  const near = towards === DARK_BACKGROUND ? Math.min(l, FILL_MAX) : Math.max(l, 1 - FILL_MAX);
  return near === l ? fill : formatHex(unitRgb(h, s, near));
}

const gap = (one: string | undefined, other: string | undefined): number | undefined => {
  const a = lightnessOf(one);
  const b = lightnessOf(other);
  return a === undefined || b === undefined ? undefined : Math.abs(a - b);
};

const mirrorEntries = (record: object, mirrorInk: (ink: string) => string | undefined, written: ReadonlySet<string>) =>
  Object.entries(record).map(([key, value]) => [
    key,
    written.has(key) ? value : typeof value === "string" ? mirrorInk(value) : Array.isArray(value) ? value.map((v) => mirrorInk(v)) : value,
  ]);

function mirrorVariables(variables: ThemeVariables, mirrorInk: (ink: string) => string | undefined, written: ReadonlySet<string>): ThemeVariables {
  return Object.fromEntries(mirrorEntries(variables, mirrorInk, written)) as unknown as ThemeVariables; // boundary: the type system's own, the keys are those of `variables`
}

// Each fill a mirrored theme holds off the page and spaces from its own stroke.
const SPACED_FILLS = [
  ["mainBkg", "nodeBorder"],
  ["clusterBkg", "clusterBorder"],
  ["actorBkg", "actorBorder"],
  ["noteBkgColor", "noteBorderColor"],
  ["activationBkgColor", "activationBorderColor"],
] as const satisfies ReadonlyArray<readonly [keyof ThemeVariables, keyof ThemeVariables]>;

// Each text a held fill carries: turned for a fill that went the other way, it is kept as it was where that reads better.
const TEXT_ON_HELD_FILLS = [["noteBkgColor", "noteTextColor"]] as const satisfies ReadonlyArray<
  readonly [keyof ThemeVariables, keyof ThemeVariables]
>;

function kept(turned: string | undefined, was: string | undefined, fill: string | undefined): string | undefined {
  const ground = rgbOf(fill);
  const now = rgbOf(turned);
  const before = rgbOf(was);
  if (ground === undefined || now === undefined || before === undefined) return turned;
  const reads = contrastRatio(now, ground);
  return reads < PLAIN_RATIO && contrastRatio(before, ground) > reads ? was : turned;
}

// A variable the source wrote is kept as written: its author chose it, on whichever ground they drew for. The rest
// of the theme is turned around it.
function mirrorTheme(theme: Theme, towards: Background): Theme {
  const mirror = (definition: string): string => mirrorDefinition(definition, towards);
  const mirrorInk = (value: string | undefined): string | undefined => (value === undefined ? undefined : mirror(value));
  const written = theme.written;
  const v = mirrorVariables(theme.variables, mirrorInk, written);
  const was = theme.variables;
  for (const [key, border] of SPACED_FILLS) {
    v[key] = written.has(key) ? was[key] : spaced(held(v[key], towards), v[border], gap(was[key], was[border]), towards);
  }
  for (const [fill, text] of TEXT_ON_HELD_FILLS) if (!written.has(text)) v[text] = kept(v[text], was[text], v[fill]);
  if (!written.has("edgeLabelBackground")) v.edgeLabelBackground = held(v.edgeLabelBackground, towards);
  const turned = { ...theme };
  for (const ink of THEME_INKS) {
    const source = INK_SOURCES[ink]?.variable;
    turned[ink] = source !== undefined && written.has(source) ? theme[ink] : mirror(theme[ink]);
  }
  const named = theme.namedLabels;
  // A label the source wrote was chosen against that band: both are kept as written rather than turned for the ground.
  v.cScale = v.cScale.map((c, at) => (named.has(at) ? was.cScale[at] : c));
  v.cScaleLabel = v.cScaleLabel.map((c, at) => (named.has(at) ? was.cScaleLabel[at] : c));
  return {
    ...turned,
    ...markerOf(mirrorInk(theme.marker)),
    sectionColors: theme.sectionColors.map((c, at) => (named.has(at) ? c : must(mirrorInk(c)))),
    variables: v,
    stated: Object.fromEntries(mirrorEntries(theme.stated, mirrorInk, written)),
  };
}

export function dressed(theme: Theme, ground: Ground | undefined): Theme {
  if (ground === undefined) return theme;
  const turned = themeSide(theme) === ground.side ? theme : mirrorTheme(theme, ground.side);
  return { ...turned, ground: ground.rgb };
}
