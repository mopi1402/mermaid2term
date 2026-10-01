import { clamp } from "../../must.js";
import { themeRgb } from "../../colour/colours.js";
import { khromaChannels, toHsl } from "../../colour/hsl.js";
import { CHANNEL_MAX, formatHex } from "../../colour/rgb.js";
import { BARE, type InkName, type StatedInk } from "../theme-model.js";

// A colour as khroma hands it from one step of a theme file to the next: the channels it last moved, printed to ten
// decimals and read back, never rounded to a byte.
type Tone =
  | { readonly kind: "hsl"; readonly h: number; readonly s: number; readonly l: number }
  | { readonly kind: "rgb"; readonly r: number; readonly g: number; readonly b: number };

export type Paint = string | Tone | typeof BARE;

// The steps a theme file derives through that no stylesheet reads.
type Step =
  | "border1" | "border2" | "secondBkg" | "mainContrastColor" | "darkTextColor" | "labelBackground"
  | "contrast" | "text" | "critical" | "done" | "taskTextLightColor";

type Seated = `${"cScale" | "cScalePeer" | "cScaleInv" | "cScaleLabel" | "pie" | "fillType" | "git" | "gitInv" | "gitBranchLabel"}${number}`;

export type Name = InkName | Step | Seated;

// A theme file's `this`: every variable it holds, by mermaid's own name.
export type Bag = { [K in Name]?: Paint | undefined } & {
  darkMode?: boolean | undefined;
  useGradient?: boolean | undefined;
  borderColorArray?: readonly string[] | undefined;
  bkgColorArray?: readonly string[] | undefined;
};

// mermaid's placeholder for a variable its `updateColors` computes later.
export const CALCULATED = "calculated";

const DEGREES = 360;
const PERCENT = 100;
const DECIMALS = 1e10;
const HSL_RE = /^hsl\(\s*(-?[\d.]+),\s*(-?[\d.]+)%,\s*(-?[\d.]+)%\)$/u;
const RGB_RE = /^rgb\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)$/u;

// khroma's `lang.round`, which every colour it prints goes through.
const printed = (value: number): number => Math.round(value * DECIMALS) / DECIMALS;

// The channels khroma reads off a value: its own `hsl()` and `rgb()` as printed, any other colour as this package does.
function tone(paint: Paint | undefined): Tone | undefined {
  if (paint === undefined || paint === BARE) return undefined;
  if (typeof paint !== "string") return paint;
  const hsl = HSL_RE.exec(paint) ?? undefined;
  if (hsl !== undefined) return { kind: "hsl", h: Number(hsl[1]), s: Number(hsl[2]), l: Number(hsl[3]) };
  const rgb = RGB_RE.exec(paint) ?? undefined;
  if (rgb !== undefined) return { kind: "rgb", r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  const value = themeRgb(paint);
  return value === undefined ? undefined : { kind: "rgb", ...value };
}

// khroma's `hsl2rgb`, unrounded, a grey's channel its lightness times 2.55 as it writes it.
const GREY_STEP = 2.55;
function channels(from: Tone): { r: number; g: number; b: number } {
  if (from.kind === "rgb") return from;
  if (from.s === 0) return { r: from.l * GREY_STEP, g: from.l * GREY_STEP, b: from.l * GREY_STEP };
  return khromaChannels(from.h / DEGREES, from.s / PERCENT, from.l / PERCENT);
}

const hslOf = (from: Tone): { h: number; s: number; l: number } => (from.kind === "hsl" ? from : toHsl(from));

interface Turn {
  readonly h?: number;
  readonly s?: number;
  readonly l?: number;
}

// khroma's `adjust`: a zero step is skipped, a hue kept as its remainder, saturation and lightness held in range.
export function adjust(paint: Paint | undefined, turn: Turn): Paint | undefined {
  const from = tone(paint);
  if (from === undefined) return undefined;
  const { h, s, l } = hslOf(from);
  const moved = (by: number | undefined): by is number => by !== undefined && by !== 0;
  return {
    kind: "hsl",
    h: printed(moved(turn.h) ? (h + turn.h) % DEGREES : h),
    s: printed(moved(turn.s) ? clamp(s + turn.s, 0, PERCENT) : s),
    l: printed(moved(turn.l) ? clamp(l + turn.l, 0, PERCENT) : l),
  };
}

export const lighten = (paint: Paint | undefined, by: number): Paint | undefined => adjust(paint, { l: by });

export const darken = (paint: Paint | undefined, by: number): Paint | undefined => adjust(paint, { l: -by });

const BORDER_DESATURATE = -40;
const BORDER_STEP = 10;

// `theme-helpers.js`.
export const mkBorder = (paint: Paint | undefined, darkMode: boolean | undefined): Paint | undefined =>
  adjust(paint, { s: BORDER_DESATURATE, l: darkMode === true ? BORDER_STEP : -BORDER_STEP });

const rgbTone = (paint: Paint | undefined, change: (channel: number) => number): Paint | undefined => {
  const from = tone(paint);
  if (from === undefined) return undefined;
  const { r, g, b } = channels(from);
  return { kind: "rgb", r: printed(change(r)), g: printed(change(g)), b: printed(change(b)) };
};

export const invert = (paint: Paint | undefined): Paint | undefined => rgbTone(paint, (channel) => CHANNEL_MAX - channel);

// khroma's `adjust` on the three RGB channels at once, by the same amount.
export const shifted = (paint: Paint | undefined, by: number): Paint | undefined =>
  rgbTone(paint, (channel) => clamp(channel + by, 0, CHANNEL_MAX));

const LINEAR_KNEE = 0.03928;
const LIGHT_FROM = 0.5;
const LUMA = { r: 0.2126, g: 0.7152, b: 0.0722 };

// khroma's `isDark`, its luminance and its knee as it writes them, tested on the channel and not its fraction.
export function isDark(paint: Paint | undefined): boolean {
  const from = tone(paint);
  if (from === undefined) return false;
  const rgb = channels(from);
  const linear = (channel: number): number => {
    const n = channel / CHANNEL_MAX;
    return channel > LINEAR_KNEE ? ((n + 0.055) / 1.055) ** 2.4 : n / 12.92;
  };
  return LUMA.r * linear(rgb.r) + LUMA.g * linear(rgb.g) + LUMA.b * linear(rgb.b) < LIGHT_FROM;
}

// A value as the stylesheet receives it: a step's channels rounded to hex as khroma's `toHex` rounds them, anything
// else as the file holds it.
export function spent(paint: Paint | undefined): StatedInk | undefined {
  if (paint === undefined || paint === CALCULATED) return undefined;
  if (paint === BARE) return BARE;
  if (typeof paint === "string" && !HSL_RE.test(paint) && !RGB_RE.test(paint)) return paint;
  const from = tone(paint);
  if (from === undefined) return undefined;
  const { r, g, b } = channels(from);
  return formatHex({ r: Math.round(r), g: Math.round(g), b: Math.round(b) });
}

// mermaid's `this.x = this.x || value`.
export const or = (v: Bag, name: Name, value: Paint | undefined): void => {
  v[name] ||= value;
};
