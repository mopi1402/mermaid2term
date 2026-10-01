import { unitHsl, unitRgb } from "./hsl.js";
import { gain } from "./palette.js";
import { GROUND_WORD, NEGATION_WORD, definitionWords } from "./style-words.js";
import { BLACK_RGB, CHANNEL_MAX, WHITE_RGB, colourRange, colourValue, formatHex, type RGB } from "./rgb.js";

const GAMMA_KNEE = 0.04045;
const GAMMA_SLOPE = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_SCALE = 1.055;
const GAMMA_EXPONENT = 2.4;
const RED_WEIGHT = 0.2126;
const GREEN_WEIGHT = 0.7152;
const BLUE_WEIGHT = 0.0722;
// Lifts both ends of the ratio, so black on black is 1 and not a division by zero.
const RATIO_LIFT = 0.05;

const linear = (channel: number): number => {
  const value = channel / CHANNEL_MAX;
  return value <= GAMMA_KNEE
    ? value / GAMMA_SLOPE
    : Math.pow((value + GAMMA_OFFSET) / GAMMA_SCALE, GAMMA_EXPONENT);
};

const luminance = (rgb: RGB): number =>
  RED_WEIGHT * linear(rgb.r) + GREEN_WEIGHT * linear(rgb.g) + BLUE_WEIGHT * linear(rgb.b);

export function contrastRatio(one: RGB, other: RGB): number {
  const first = luminance(one);
  const second = luminance(other);
  const high = Math.max(first, second);
  const low = Math.min(first, second);
  return (high + RATIO_LIFT) / (low + RATIO_LIFT);
}

const DARKEST = 0;
const LIGHTEST = 1;
// Eight puts the answer within 1/256 of the boundary, finer than a channel holds, so a ninth returns the same bytes.
const HALVINGS = 8;

// Not 1: a lightness taken to either end drops its chroma on the way, so asking a ground for ALL it can carry
// answers black or white, the one answer with no hue left in it.
const REACH = 0.85;

const away = (ground: RGB): number => (contrastRatio(WHITE_RGB, ground) >= PLAIN_RATIO ? LIGHTEST : DARKEST);

const ceiling = (ink: RGB, ground: RGB): number =>
  contrastRatio(away(ground) === LIGHTEST ? WHITE_RGB : BLACK_RGB, ground) * (unitHsl(ink).s > 0 ? REACH : 1);

const asked = (ink: RGB, ground: RGB, ratio: number): number => Math.min(ratio, ceiling(ink, ground));

const carriesOn = (ink: RGB, ground: RGB, ratio: number): boolean =>
  contrastRatio(ink, ground) >= asked(ink, ground, ratio);

function readableOn(ink: RGB, ground: RGB, ratio: number): RGB {
  if (carriesOn(ink, ground, ratio)) return ink;
  const wanted = asked(ink, ground, ratio);
  const { h, s, l } = unitHsl(ink);
  const carries = (lightness: number): boolean => contrastRatio(unitRgb(h, s, lightness), ground) >= wanted;
  const far = away(ground);
  if (!carries(far)) return unitRgb(h, s, far);
  let near = l;
  let reached = far;
  for (let step = 0; step < HALVINGS; step++) {
    const middle = (near + reached) / 2;
    if (carries(middle)) reached = middle;
    else near = middle;
  }
  return unitRgb(h, s, reached);
}

const DIM_WORD = "dim";
const DIM_SHORT = "d";

const DIM_STRENGTH = 0.5;

// LOW on purpose. WCAG's 4.5 and 7 are built on luminance alone and are harsh on saturated colour; asked for 7,
// a fill of any strength leaves nothing but near-black or near-white.
export const PLAIN_RATIO = 3;
export const QUIET_RATIO = 2.4;
export const RULE_RATIO = 1.8;

const spent = (ink: RGB, quiet: boolean): RGB => (quiet ? gain(ink, DIM_STRENGTH) : ink);

const isDim = (word: string): boolean => word === DIM_WORD || word === DIM_SHORT;

// Keeps a style's words minus its dim ones, handing each colour word to `onColour` to place in its stead.
function sortStyleWords(words: readonly string[], kept: string[], onColour: (word: string, value: RGB) => void): void {
  for (let index = 0; index < words.length; index++) {
    const word = words[index].toLowerCase();
    if (word === GROUND_WORD || word === NEGATION_WORD) {
      kept.push(words[index]);
      const behind = words[++index];
      if (behind !== undefined) kept.push(behind);
      continue;
    }
    if (isDim(word)) continue;
    const value = colourValue(word);
    if (value === undefined) {
      kept.push(words[index]);
      continue;
    }
    onColour(words[index], value);
  }
}

export function inkedStyle(definition: string, ink: string): string {
  const kept: string[] = [];
  let placed = false;
  sortStyleWords(definitionWords(definition), kept, () => {
    if (!placed) kept.push(ink);
    placed = true;
  });
  if (!placed) kept.unshift(ink);
  return kept.join(" ");
}

export function readableStyle(definition: string, ground: RGB, ratio = PLAIN_RATIO, quietRatio = QUIET_RATIO): string {
  const words = definitionWords(definition);
  const quiet = words.some((word) => isDim(word.toLowerCase()));
  const wanted = quiet ? quietRatio : ratio;

  const kept: string[] = [];
  let ink: RGB | undefined;
  let range: readonly RGB[] = [];
  let at = -1;
  sortStyleWords(words, kept, (word, value) => {
    ink = value;
    range = colourRange(word.toLowerCase());
    at = kept.length;
    kept.push(word);
  });

  if (ink === undefined) {
    ink = WHITE_RGB;
    range = [ink];
    at = kept.length;
    kept.push(formatHex(ink));
  }
  if (range.every((value) => carriesOn(spent(value, quiet), ground, wanted))) return definition;
  kept[at] = formatHex(readableOn(spent(ink, quiet), ground, wanted));
  return kept.join(" ");
}
