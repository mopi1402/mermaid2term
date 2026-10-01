import { ACTOR, ACTOR_INDEXED, BAND_MARK, COMPOSITE, LABEL, bandApart } from "../canvas/keys.js";
import { readableStyle } from "../colour/contrast.js";
import { formatHex, type RGB } from "../colour/rgb.js";
import { isFill } from "./mix.js";
import { without } from "./style.js";
import { type Theme } from "./theme-model.js";
import { BACKGROUND, BOLD, UNDERLINE, EMPTY } from "./tokens.js";

export const MARKER_DROPS = ["italic", "dim"];

const FAINT_STYLE = "dim bright_black";

export const faintOf = (th: Theme): string => th.variables.m2t_faintColor ?? FAINT_STYLE;

export const ACTIVE_MIX = 0.5;

export const CHIP_TINT = 0.2;

const withoutBold = (style: string): string => without(style, BOLD);

export const plainLabel = (th: Theme): string => withoutBold(th.label);

// Words on a fill, inked to read on it.
export const textOnFill = (style: string, ground: RGB, ratio?: number, quietRatio?: number): string =>
  `${readableStyle(style, ground, ratio, quietRatio)} ${BACKGROUND}${formatHex(ground)}`;

export const labelKeys = (styleMap: Map<string, string>, key: string, ink: string, bg: string): void => {
  styleMap.set(`${key}${COMPOSITE}${LABEL}`, `${ink} ${bg}`.trim());
};

export const isActorKey = (key: string, tail: string): boolean =>
  key.endsWith(tail) && (key === ACTOR + tail || key.startsWith(ACTOR_INDEXED));

export const underlined = (style: string): string => (style === EMPTY ? UNDERLINE : `${style} ${UNDERLINE}`);

export const linked = (style: string, url: string | undefined): string => (url === undefined ? style : underlined(style));

export const seatedOnFill = (key: string): boolean => {
  const band = bandApart(key)[1];
  return band !== "" && isFill(band.slice(BAND_MARK.length));
};
