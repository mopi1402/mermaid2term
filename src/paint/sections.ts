import { BAND_MARK, SECTION_BACKGROUND_PREFIX, SECTION_FOREGROUND_PREFIX, SECTION_PREFIX, SHAPE_ELEMENTS, bandApart, elementKey } from "../canvas/keys.js";
import { themeRgb } from "../colour/colours.js";
import { formatHex, type RGB } from "../colour/rgb.js";
import { QUIET_RATIO, RULE_RATIO, readableStyle } from "../colour/contrast.js";
import { LIGHT_BACKGROUND, sideOf } from "../colour/background.js";
import { BACKGROUND, BOLD, DIM } from "./tokens.js";
import { gain, mixRGB } from "../colour/palette.js";
import { FOREGROUND_GAIN, SECTION_BAND_MIX, firstInk, pageOf } from "./mix.js";
import { REDUX_THEMES, type Ink, type Theme } from "./theme-model.js";
import { inked } from "./style.js";

const WHITE_INK_NAME = "white";
const BLACK_INK_NAME = "black";
const DIGITS_RE = /^\d+$/u;
const PREFIXES = [SECTION_PREFIX, SECTION_FOREGROUND_PREFIX, SECTION_BACKGROUND_PREFIX];

// A mindmap node's key says the element mermaid draws its shape with, which a `themeCSS` rule may reach alone.
export const shapedStyles = (key: string, style: string): Array<readonly [string, string]> =>
  SHAPE_ELEMENTS.map((element) => [elementKey(key, element), style]);

// mermaid's timeline takes `section % THEME_COLOR_LIMIT`: past the last seat the scale starts over.
export const seatOf = (th: Theme, index: number): number => index % Math.max(1, th.sectionColors.length);

// The number after `prefix` wherever it stands in the key, `-1` where the key holds no such prefix.
const indexWithin = (key: string, prefix: string): number => {
  const at = key.indexOf(prefix);
  return at === -1 ? -1 : Number.parseInt(key.slice(at + prefix.length), 10);
};

// How many sections a drawing names, its band tails included, so every one of them finds a style.
export function sectionsNamed(keys: Iterable<string>, floor: number): number {
  let count = floor;
  for (const key of keys) {
    for (const prefix of PREFIXES) {
      const index = indexWithin(key, prefix);
      if (Number.isInteger(index)) count = Math.max(count, index + 1);
    }
    const tail = bandApart(key)[1].slice(BAND_MARK.length);
    if (DIGITS_RE.test(tail)) count = Math.max(count, Number(tail) + 1);
  }
  return count;
}

// A label the source wrote is laid as written. The theme's own, or white where it names none, is weighed against the
// band, black standing in for a white the band cannot carry.
export function onBand(th: Theme, at: number, fill: string): string {
  const seat = seatOf(th, at);
  return labelOnFill(th.variables.cScaleLabel[seat], fill, th.namedLabels.has(seat));
}

// mermaid's `.section-root`: `git0` under `gitBranchLabel0`, which a redux theme swaps for `nodeBorder`.
export function rootBand(th: Theme): string | undefined {
  const v = th.variables;
  return v.git0 === undefined ? undefined : labelOnFill(REDUX_THEMES.has(th.name) ? v.nodeBorder : v.gitBranchLabel0, v.git0, false);
}

function labelOnFill(label: Ink, fill: string, asWritten: boolean): string {
  const ground = themeRgb(fill);
  const white = `${BOLD} ${WHITE_INK_NAME}`;
  const ink =
    ground === undefined || asWritten
      ? `${BOLD} ${label ?? WHITE_INK_NAME}`
      : label !== undefined
        ? readableStyle(`${BOLD} ${label}`, ground)
        : readableStyle(white, ground) === white
          ? white
          : readableStyle(`${BOLD} ${BLACK_INK_NAME}`, ground);
  return `${ink} ${BACKGROUND}${fill}`;
}

// The section's colour written straight on the page where it reads there; a band too dark for a dark page is
// lifted as it always was, and whatever still does not read is weighed, at the quiet ratio so a blue the lift leaves
// just under the plain one keeps its bytes.
export function pageInk(page: RGB, rgb: RGB, weight: string): string {
  const styled = (ink: RGB): string => inked(weight, formatHex(ink));
  const weighed = (ink: RGB): string => readableStyle(styled(ink), page, QUIET_RATIO, RULE_RATIO);
  const own = weighed(rgb);
  if (own === styled(rgb)) return own;
  return sideOf(page) === LIGHT_BACKGROUND ? own : weighed(gain(rgb, FOREGROUND_GAIN));
}

// A theme's ink laid on the page as a seat's colour, or the fallback where it names none.
export const seatOnPage = (th: Theme, ink: Ink, weight: string, fallback: string): string => {
  const rgb = themeRgb(ink);
  return rgb === undefined ? fallback : pageInk(pageOf(th), rgb, weight);
};

// A theme's ink written as text on the page, weighed to read there; `undefined` where it names no colour.
export const textOnPage = (th: Theme, ink: Ink, weight: string, ratio?: number, quietRatio?: number): string | undefined =>
  themeRgb(ink) === undefined ? undefined : readableStyle(inked(weight, ink), pageOf(th), ratio, quietRatio);

export interface SectionInks {
  readonly ink: string;
  readonly dim: string;
  readonly band: string;
  readonly wash: RGB;
}

// A gantt writes its section's name on the section's own wash, so the ink is weighed once more on that wash.
export function sectionInks(th: Theme, rgb: RGB): SectionInks {
  const page = pageOf(th);
  const onPage = pageInk(page, rgb, BOLD);
  const wash = mixRGB(page, firstInk(onPage) ?? rgb, SECTION_BAND_MIX);
  return {
    ink: readableStyle(onPage, wash, QUIET_RATIO, RULE_RATIO),
    dim: readableStyle(pageInk(page, rgb, DIM), wash, QUIET_RATIO, RULE_RATIO),
    band: BACKGROUND + formatHex(wash),
    wash,
  };
}
