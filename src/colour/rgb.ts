import { must } from "../must.js";

export const STANDARD_COLORS: readonly string[] = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "bright_black",
  "bright_red",
  "bright_green",
  "bright_yellow",
  "bright_blue",
  "bright_magenta",
  "bright_cyan",
  "bright_white",
];

const STANDARD_VALUES: readonly string[] = [
  "#000000",
  "#bb0000",
  "#00bb00",
  "#bbbb00",
  "#0000bb",
  "#bb00bb",
  "#00bbbb",
  "#ffffff",
  "#555555",
  "#ff5555",
  "#00ff00",
  "#ffff55",
  "#5555ff",
  "#ff55ff",
  "#55ffff",
  "#ffffff",
];

export const BRIGHT_FIRST = 8;

export const HEX_MARK = "#";
export const HEX_RE = /^#[0-9a-f]{6}$/iu;
const SHORT_HEX_RE = /^#[0-9a-f]{3}$/iu;
export const HEX_BASE = 16;
const CHANNEL_WIDTH = 2;
export const CHANNEL_MAX = 255;

export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export const BLACK_RGB: RGB = { r: 0, g: 0, b: 0 };
export const WHITE_RGB: RGB = { r: CHANNEL_MAX, g: CHANNEL_MAX, b: CHANNEL_MAX };

// `#rrggbb`, or `#rgb` each digit doubled, the short form CSS and mermaid's own colour reader both take.
export function parseHex(text: string): RGB | undefined {
  if (SHORT_HEX_RE.test(text)) return parseHex(HEX_MARK + [...text.slice(HEX_MARK.length)].map((digit) => digit + digit).join(""));
  if (!HEX_RE.test(text)) return undefined;
  const digits = text.slice(HEX_MARK.length);
  const channel = (at: number): number => parseInt(digits.slice(at, at + CHANNEL_WIDTH), HEX_BASE);
  return { r: channel(0), g: channel(CHANNEL_WIDTH), b: channel(CHANNEL_WIDTH * 2) };
}

export const formatHex = (rgb: RGB): string =>
  HEX_MARK +
  [rgb.r, rgb.g, rgb.b]
    .map((channel) => channel.toString(HEX_BASE).toUpperCase().padStart(CHANNEL_WIDTH, "0"))
    .join("");

export function colourValue(word: string): RGB | undefined {
  const index = STANDARD_COLORS.indexOf(word);
  if (index >= 0) return parseHex(STANDARD_VALUES[index]);
  return parseHex(word);
}

export function colourRange(word: string): readonly RGB[] {
  const index = STANDARD_COLORS.indexOf(word);
  if (index < 0) {
    const rgb = parseHex(word);
    return rgb === undefined ? [] : [rgb];
  }
  const plain = index % BRIGHT_FIRST;
  return [plain, plain + BRIGHT_FIRST].map((at) => must(parseHex(STANDARD_VALUES[at])));
}
