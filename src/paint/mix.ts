import {
  BAND_MARK,
  BOLD_MARK,
  FADE_JOIN,
  FADE_WORDS,
  FADE_MARK,
  FONT_JOIN,
  FONT_MARK,
  INK_MARK,
  ITALIC_MARK,
  RIM_TAIL,
  SECTION_BACKGROUND_PREFIX,
  bandApart,
  inkApart,
} from "../canvas/keys.js";
import { inkedStyle } from "../colour/contrast.js";
import { mixRGB } from "../colour/palette.js";
import { BLACK_RGB, HEX_MARK, WHITE_RGB, colourValue, formatHex, parseHex, type RGB } from "../colour/rgb.js";
import { GROUND_WORD } from "../colour/style-words.js";
import { SPACE } from "../text/chars.js";
import { without } from "./style.js";
import { type Theme } from "./theme-model.js";
import { BACKGROUND, BOLD, DIM, EMPTY, ITALIC } from "./tokens.js";

export const bandStyle = (tail: string, styleMap: ReadonlyMap<string, string>): string =>
  isFill(tail) ? BACKGROUND + tail : (styleMap.get(SECTION_BACKGROUND_PREFIX + tail) ?? EMPTY);

export const isFill = (tail: string): boolean => tail.startsWith(HEX_MARK);

export const slabInk = (fill: string | undefined, stroke: string): string =>
  fill === undefined || !fill.startsWith(BACKGROUND) ? stroke : fill.slice(BACKGROUND.length);

export const FOREGROUND_GAIN = 3;

const STRIPE_MIX = 0.1;

export const pageOf = (th: Theme): RGB => th.ground ?? BLACK_RGB;

export const firstInk = (style: string): RGB | undefined => {
  for (const word of style.split(SPACE)) {
    const rgb = colourValue(word);
    if (rgb !== undefined) return rgb;
  }
  return undefined;
};

export const firstHex = (style: string): RGB | undefined => {
  for (const word of style.split(SPACE)) {
    const rgb = parseHex(word);
    if (rgb !== undefined) return rgb;
  }
  return undefined;
};

const RGBA_RE = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d*\.?\d+)\s*\)$/iu;

export const laidOn = (style: string, ground: RGB): string =>
  style
    .split(SPACE)
    .map((word) => {
      const found = RGBA_RE.exec(word) ?? undefined;
      if (found === undefined) return word;
      const [, r, g, b, a] = found;
      return formatHex(mixRGB(ground, { r: Number(r), g: Number(g), b: Number(b) }, Math.min(1, Number(a))));
    })
    .join(SPACE);

export const stripeOf = (th: Theme): RGB => mixRGB(pageOf(th), firstHex(th.label) ?? WHITE_RGB, STRIPE_MIX);

export const stripeGround = (th: Theme): string => BACKGROUND + formatHex(stripeOf(th));

export const GRID_MIX = 0.2;

export const SECTION_BAND_MIX = 0.08;

export const inkOff = (key: string): [string, string | undefined] => {
  const [base, ink] = inkApart(key);
  return [base, ink === "" ? undefined : ink.slice(INK_MARK.length)];
};

// A stroke inked before its wall moved onto the cell edge, `x@ink:c@rim`, reads as the wall's ground with the ink last.
// A band laid after the rim, `x@ink:c@rim@bg:f`, stays at the end where the painter reads it.
export const rimFirst = (key: string): string => {
  const base = baseKey(key);
  const band = key.slice(base.length);
  const at = base.lastIndexOf(INK_MARK);
  return at === -1 || !base.endsWith(RIM_TAIL) ? key : base.slice(0, at) + RIM_TAIL + base.slice(at, -RIM_TAIL.length) + band;
};

interface KeyMarks {
  readonly key: string;
  readonly weight: string | undefined;
  readonly font: readonly string[];
  readonly fade: string | undefined;
}

// The weight a key asks for, the font and the fade its CSS adds, off the key, in whichever order they were laid:
// what is left is looked up as it always was.
const weightOff = (key: string): KeyMarks => {
  let bare = key;
  let font: readonly string[] = [];
  let fade: string | undefined;
  for (;;) {
    const fontAt = bare.lastIndexOf(FONT_MARK);
    const fadeAt = bare.lastIndexOf(FADE_MARK);
    if (fontAt === -1 && fadeAt === -1) break;
    if (fontAt > fadeAt) font = bare.slice(fontAt + FONT_MARK.length).split(FONT_JOIN);
    else fade = bare.slice(fadeAt + FADE_MARK.length);
    bare = bare.slice(0, Math.max(fontAt, fadeAt));
  }
  if (bare.endsWith(BOLD_MARK)) return { key: bare.slice(0, -BOLD_MARK.length), weight: BOLD, font, fade };
  if (bare.endsWith(ITALIC_MARK)) return { key: bare.slice(0, -ITALIC_MARK.length), weight: ITALIC, font, fade };
  return { key: bare, weight: undefined, font, fade };
};

export interface ReadKey extends KeyMarks {
  readonly ink: string | undefined;
  readonly band: string | undefined;
}

// A painted key taken apart as both painters read it: its band off the end, then its ink, then its marks.
export const readKey = (key: string): ReadKey => {
  const [base, band] = bandApart(key);
  const [inkedKey, ink] = inkOff(base);
  return { ...weightOff(inkedKey), ink, band: band === "" ? undefined : band.slice(BAND_MARK.length) };
};

// A key whose fade shows none of its ground: its blank is the page, and trims as the page does.
export const showsNoGround = (key: string): boolean => Number(readKey(key).fade?.split(FADE_JOIN)[1] ?? 1) === 0;

// The style a key's palette entry gives, with the weight and the font its marks add.
const dressed = (found: string, marks: KeyMarks): string => withFont(withWeight(found, marks.weight), marks.font);

// A cell's style: its palette entry dressed, and a glyph's own ink laid over it; `inksBare` lays that ink on a key the
// palette does not know too.
export const keyStyle = (read: ReadKey, found: string | undefined, ch: string, inksBare: boolean): string | undefined => {
  const known = found === undefined ? undefined : dressed(found, read);
  if (read.ink === undefined || ch === SPACE || (known === undefined && !inksBare)) return known;
  return inkedStyle(known ?? EMPTY, read.ink);
};

// A fill band as a faded cell shows it, mixed with the page by the share of the ground that shows: what its words are
// weighed against.
export const shownFill = (tail: string, fade: string | undefined, page: RGB): string => {
  const rgb = fade === undefined || !isFill(tail) ? undefined : parseHex(tail);
  return rgb === undefined || fade === undefined ? tail : formatHex(mixRGB(page, rgb, Number(fade.split(FADE_JOIN)[1])));
};

// A faded node's colours, each mixed with what lies under it by the share of it that shows: the ground with the page
// by the fade's second part, every other colour by its first. A word lies on the ground as it shows, its own element
// over the shape in mermaid's SVG; an outline is the shape's own and lies on the page. An ink the terminal owns, which
// no colour names, is dimmed instead.
export const fadedStyle = (style: string, fade: string | undefined, page: RGB): string => {
  if (fade === undefined) return style;
  const [linesSaid, groundSaid, over] = fade.split(FADE_JOIN);
  const lines = Number(linesSaid);
  const ground = Number(groundSaid);
  const out: string[] = [];
  let onGround = false;
  let inked = false;
  const words = style.split(SPACE).filter((said) => said !== EMPTY);
  const own = over === FADE_WORDS ? colourValue(words[words.indexOf(GROUND_WORD) + 1] ?? EMPTY) : undefined;
  const under = own === undefined || !words.includes(GROUND_WORD) ? page : mixRGB(page, own, ground);
  for (const [at, word] of words.entries()) {
    // A ground that shows nothing is left off: the node's cells show what lies under them.
    if (ground === 0 && (word === GROUND_WORD || words[at - 1] === GROUND_WORD)) continue;
    const rgb = colourValue(word);
    // An ink that shows nothing is left off as well.
    if (rgb !== undefined && !onGround && lines === 0) {
      onGround = false;
      continue;
    }
    if (rgb !== undefined) {
      out.push(formatHex(onGround ? mixRGB(page, rgb, ground) : mixRGB(under, rgb, lines)));
      inked ||= !onGround;
    } else out.push(word);
    onGround = word === GROUND_WORD;
  }
  if (!inked && lines > 0 && lines < 1 && !style.trim().startsWith(GROUND_WORD)) out.unshift(DIM);
  return out.join(SPACE);
};

// A CSS font adds to the style: an italic class name stays bold.
export const withFont = (style: string, font: readonly string[]): string => {
  const said = style.split(SPACE);
  const added = font.filter((word) => !said.includes(word));
  return added.length === 0 ? style : `${added.join(SPACE)} ${style}`.trim();
};

// Laid the way `labelKeys` lays it on a node's own label: the weight first, the one it replaces taken out, so a
// word bold inside a bold row is bold once and an italic inside a bold one is italic alone.
export const withWeight = (style: string, weight: string | undefined): string => {
  if (weight === undefined) return style;
  const plain = without(style, BOLD);
  return `${weight} ${weight === BOLD ? plain : without(plain, ITALIC)}`.trim();
};

export const baseKey = (key: string): string => bandApart(key)[0];

export const melted = (key: string): readonly [string, string] => [SPACE, bandApart(key)[1]];

export const EXCLUDED_MIX = 0.15;

export const RULE_MIX = 0.1;

export const faintInk = (th: Theme, by: number): string =>
  formatHex(mixRGB(pageOf(th), firstHex(th.label) ?? WHITE_RGB, by));

// A band a drawing asks for by NAME, resolved to the theme's own colour at paint time: what a box is filled with is
// the theme's business, and the renderer that laid the band has no reading of it.
export const themeBandResolved = (key: string, fills: ReadonlyMap<string, RGB | undefined>): string => {
  for (const [named, fill] of fills) {
    if (!key.endsWith(named)) continue;
    const bare = key.slice(0, -named.length);
    return fill === undefined ? bare : `${bare}${BAND_MARK}${formatHex(fill)}`;
  }
  return key;
};
