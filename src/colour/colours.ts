import { clamp } from "../must.js";
import { CSS_NAMED } from "../tables/css-colours.js";
import { unitChannels } from "./hsl.js";
import { CHANNEL_MAX, HEX_BASE, HEX_MARK, colourValue, formatHex, parseHex, type RGB } from "./rgb.js";

const TRANSPARENT = "transparent";

const NAMED_HEX: ReadonlyMap<string, string> = new Map(
  CSS_NAMED.trim()
    .split(/\s+/u)
    .map((pair) => {
      const [name, hex] = pair.split(":");
      return [name, `${HEX_MARK}${hex}`] as const;
    })
);

const CSS_COLOUR_NAMES: ReadonlySet<string> = new Set([...NAMED_HEX.keys(), TRANSPARENT]);

const COLOUR_VALUE_RE = /^(?:(?:rgba?|hsla?)\s*\([^)]*\)|#[0-9a-f]{3,8})/iu;
const FUNCTIONAL_RE = /^(rgba?|hsla?)\s*\(([^)]*)\)$/iu;

export function splitColour(text: string): [string | undefined, string] {
  const value = COLOUR_VALUE_RE.exec(text) ?? undefined;
  if (value !== undefined) return [value[0], text.slice(value[0].length).trim()];

  const cut = text.search(/\s/u);
  const first = cut < 0 ? text : text.slice(0, cut);
  if (first !== "" && CSS_COLOUR_NAMES.has(first.toLowerCase())) {
    return [first, cut < 0 ? "" : text.slice(cut).trim()];
  }
  return [undefined, text.trim()];
}

const byte = (value: number): number => clamp(Math.round(value), 0, CHANNEL_MAX);
const lowerHex = (r: number, g: number, b: number): string => formatHex({ r: byte(r), g: byte(g), b: byte(b) }).toLowerCase();

const scalar = (written: string, full: number): number => {
  const text = written.trim();
  const value = Number.parseFloat(text);
  if (Number.isNaN(value)) return 0;
  return text.endsWith("%") ? (value / 100) * full : value;
};

// A hue in degrees, as khroma reads its unit: `deg` or none, `grad`, `rad`, `turn`.
const HUE_UNITS: ReadonlyMap<string, number> = new Map([["deg", 1], ["grad", 0.9], ["rad", 180 / Math.PI], ["turn", 360]]);
const HUE_RE = /^(.+?)(deg|grad|rad|turn)$/iu;
const hueDegrees = (written: string): number => {
  const unit = HUE_RE.exec(written) ?? undefined;
  const value = Number.parseFloat(unit === undefined ? written : unit[1]);
  return Number.isNaN(value) ? 0 : value * (unit === undefined ? 1 : (HUE_UNITS.get(unit[2].toLowerCase()) ?? 1));
};

// A hue in any turn, as khroma takes it.
const fromHSL = (h: number, s: number, l: number): [number, number, number] => unitChannels(((h % 1) + 1) % 1, s, l);

export function colourToHex(spec: string): string | undefined {
  const written = spec.trim();
  const named = NAMED_HEX.get(written.toLowerCase());
  if (named !== undefined) return named;
  if (written.toLowerCase() === TRANSPARENT) return undefined;

  if (written.startsWith(HEX_MARK)) {
    const digits = written.slice(HEX_MARK.length);
    if (digits.length === 3 || digits.length === 4) {
      const [r, g, b] = [...digits.slice(0, 3)].map((d) => Number.parseInt(d + d, HEX_BASE));
      return lowerHex(r, g, b);
    }
    if (digits.length === 6 || digits.length === 8) {
      const [r, g, b] = [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), HEX_BASE));
      return lowerHex(r, g, b);
    }
    return undefined;
  }

  const functional = FUNCTIONAL_RE.exec(written) ?? undefined;
  if (functional === undefined) return undefined;
  // khroma's reading: the channels apart by commas or by spaces, the alpha after a comma or a slash.
  const parts = functional[2].split(/[\s,/]+/u).filter((part) => part !== "");
  if (parts.length < 3) return undefined;
  const alpha = parts.length > 3 ? clamp(scalar(parts[3], 1), 0, 1) : 1;
  const hsl = functional[1].toLowerCase().startsWith("hsl");
  const [r, g, b] = hsl
    ? fromHSL(hueDegrees(parts[0]) / 360, scalar(parts[1], 1), scalar(parts[2], 1))
    : [0, 1, 2].map((at) => scalar(parts[at], CHANNEL_MAX));
  return lowerHex(r * alpha, g * alpha, b * alpha);
}

// A colour the terminal reads kept as written, any other CSS colour turned to hex.
export const cssColour = (spec: string | undefined): string | undefined =>
  spec === undefined || colourValue(spec.toLowerCase()) !== undefined ? spec : (colourToHex(spec) ?? spec);

// A theme's ink as the colour it names: a terminal colour name as that colour, any other CSS colour as its hex.
export const themeRgb = (ink: string | undefined): RGB | undefined =>
  ink === undefined ? undefined : (colourValue(ink.toLowerCase()) ?? parseHex(colourToHex(ink) ?? ""));
