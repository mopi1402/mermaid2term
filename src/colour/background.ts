import { unitHsl, unitRgb } from "./hsl.js";
import type { RGB } from "./rgb.js";

export const DARK_BACKGROUND = "dark";
export const LIGHT_BACKGROUND = "light";
export type Background = typeof DARK_BACKGROUND | typeof LIGHT_BACKGROUND;

const FULL_TURN = 1;
const LIGHT_FROM = 0.5;

export const sideOf = (rgb: RGB): Background => (unitHsl(rgb).l > LIGHT_FROM ? LIGHT_BACKGROUND : DARK_BACKGROUND);

const HALF = 0.5;
// The lift fades with the CUBE of the distance to the middle: a power curve gave `forest`'s olive fills a green
// as loud as its arrows.
const OPENING = 0.17;
const FADING = 3;

export function mirrorRgb(rgb: RGB, towards?: Background): RGB {
  const { h, s, l } = unitHsl(rgb);
  const flipped = FULL_TURN - l;
  if (towards === undefined) return unitRgb(h, s, flipped);
  const off = towards === DARK_BACKGROUND ? flipped : FULL_TURN - flipped;
  if (off >= HALF) return unitRgb(h, s, flipped);
  const opened = off + OPENING * Math.pow(FULL_TURN - off / HALF, FADING);
  return unitRgb(h, s, towards === DARK_BACKGROUND ? opened : FULL_TURN - opened);
}

const MIRRORED: ReadonlyMap<number, number> = new Map([
  [0, 15],
  [7, 0],
  [8, 0],
  [15, 0],
  [9, 1],
  [10, 2],
  [11, 3],
  [12, 4],
  [13, 5],
  [14, 6],
]);

export const mirrorStandard = (index: number): number => MIRRORED.get(index) ?? index;
