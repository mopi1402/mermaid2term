import { CHANNEL_MAX, type RGB } from "./rgb.js";

// The unit reading turns grounds and inks, khroma's derives a theme: their saturations differ enough to move a byte.

export interface HSL {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

const SECTORS = 6;
const DEGREES = 360;
const PERCENT = 100;
const HALF = 0.5;
const THIRD = 1 / 3;
const SIXTH = 1 / 6;
const TWO_THIRDS = 2 / 3;

// The hue as a turn, the lightness, and the channel extremes both saturations are read from.
function hueAndLightness(rgb: RGB): { h: number; l: number; high: number; low: number; span: number } {
  const r = rgb.r / CHANNEL_MAX;
  const g = rgb.g / CHANNEL_MAX;
  const b = rgb.b / CHANNEL_MAX;
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  const l = (high + low) / 2;
  const span = high - low;
  if (span === 0) return { h: 0, l, high, low, span };
  const h =
    high === r
      ? ((g - b) / span + (g < b ? SECTORS : 0)) / SECTORS
      : high === g
        ? ((b - r) / span + 2) / SECTORS
        : ((r - g) / span + 4) / SECTORS;
  return { h, l, high, low, span };
}

export function unitHsl(rgb: RGB): HSL {
  const { h, l, span } = hueAndLightness(rgb);
  if (span === 0) return { h: 0, s: 0, l };
  return { h, s: span / (1 - Math.abs(2 * l - 1)), l };
}

// The channels of a unit hue, saturation and lightness, unrounded.
export function unitChannels(h: number, s: number, l: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const sector = h * SECTORS;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = l - chroma / 2;
  const [r, g, b] =
    sector < 1
      ? [chroma, second, 0]
      : sector < 2
        ? [second, chroma, 0]
        : sector < 3
          ? [0, chroma, second]
          : sector < 4
            ? [0, second, chroma]
            : sector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];
  return [(r + base) * CHANNEL_MAX, (g + base) * CHANNEL_MAX, (b + base) * CHANNEL_MAX];
}

export function unitRgb(h: number, s: number, l: number): RGB {
  const [r, g, b] = unitChannels(h, s, l);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

// khroma's `rgb2hsl`, in degrees and percent.
export function toHsl(rgb: RGB): HSL {
  const { h, l, high, low, span } = hueAndLightness(rgb);
  if (span === 0) return { h: 0, s: 0, l: l * PERCENT };
  const s = span / (l > HALF ? 2 - high - low : high + low);
  return { h: h * DEGREES, s: s * PERCENT, l: l * PERCENT };
}

const hueToChannel = (p: number, q: number, turn: number): number => {
  const t = turn < 0 ? turn + 1 : turn > 1 ? turn - 1 : turn;
  if (t < SIXTH) return p + (q - p) * 6 * t;
  if (t < HALF) return q;
  if (t < TWO_THIRDS) return p + (q - p) * (TWO_THIRDS - t) * 6;
  return p;
};

// khroma's `hsl2rgb` on a unit hue, saturation and lightness, unrounded; a grey is each caller's own.
export function khromaChannels(h: number, s: number, l: number): RGB {
  const q = l < HALF ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: hueToChannel(p, q, h + THIRD) * CHANNEL_MAX, g: hueToChannel(p, q, h) * CHANNEL_MAX, b: hueToChannel(p, q, h - THIRD) * CHANNEL_MAX };
}

export const clampPercent = (value: number): number => (value >= PERCENT ? PERCENT : value < 0 ? 0 : value);
export const wrapDegrees = (value: number): number => ((value % DEGREES) + DEGREES) % DEGREES;

export function fromHsl(hsl: HSL): RGB {
  const h = wrapDegrees(hsl.h) / DEGREES;
  const s = clampPercent(hsl.s) / PERCENT;
  const l = clampPercent(hsl.l) / PERCENT;
  if (s === 0) {
    const grey = Math.round(l * CHANNEL_MAX);
    return { r: grey, g: grey, b: grey };
  }
  const { r, g, b } = khromaChannels(h, s, l);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}
