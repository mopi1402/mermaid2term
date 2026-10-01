import { clamp } from "../must.js";
import { clampPercent, fromHsl, toHsl, wrapDegrees } from "./hsl.js";
import { CHANNEL_MAX, type RGB } from "./rgb.js";

interface Shift {
  readonly h?: number;
  readonly s?: number;
  readonly l?: number;
}

export function adjust(rgb: RGB, shift: Shift): RGB {
  const hsl = toHsl(rgb);
  return fromHsl({
    h: shift.h === undefined ? hsl.h : wrapDegrees(hsl.h + shift.h),
    s: shift.s === undefined ? hsl.s : clampPercent(hsl.s + shift.s),
    l: shift.l === undefined ? hsl.l : clampPercent(hsl.l + shift.l),
  });
}

// khroma's `adjust` on the RGB channels, each moved by the same amount and held within a channel's range.
export const shiftChannels = (rgb: RGB, by: number): RGB => {
  const held = (channel: number): number => clamp(channel + by, 0, CHANNEL_MAX);
  return { r: held(rgb.r), g: held(rgb.g), b: held(rgb.b) };
};

export const lighten = (rgb: RGB, by: number): RGB => adjust(rgb, { l: by });
export const darken = (rgb: RGB, by: number): RGB => adjust(rgb, { l: -by });
export const invert = (rgb: RGB): RGB => ({
  r: CHANNEL_MAX - rgb.r,
  g: CHANNEL_MAX - rgb.g,
  b: CHANNEL_MAX - rgb.b,
});

const BORDER_DESATURATE = -40;
const BORDER_STEP = 10;
export const mkBorder = (rgb: RGB, darkMode: boolean): RGB =>
  adjust(rgb, { s: BORDER_DESATURATE, l: darkMode ? BORDER_STEP : -BORDER_STEP });

export const gain = (rgb: RGB, by: number): RGB => ({
  r: Math.round(Math.min(CHANNEL_MAX, rgb.r * by)),
  g: Math.round(Math.min(CHANNEL_MAX, rgb.g * by)),
  b: Math.round(Math.min(CHANNEL_MAX, rgb.b * by)),
});

export const mixRGB = (ground: RGB, ink: RGB, by: number): RGB => ({
  r: Math.round(ground.r + (ink.r - ground.r) * by),
  g: Math.round(ground.g + (ink.g - ground.g) * by),
  b: Math.round(ground.b + (ink.b - ground.b) * by),
});
