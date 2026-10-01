import { BLOCK } from "../canvas/alphabet.js";
import { themeRgb } from "../colour/colours.js";
import {
  COMPOSITE_TITLE_FILL,
  DEFAULT_STYLE,
  FRAME_FILLS,
  isChip,
} from "../canvas/keys.js";
import { formatHex } from "../colour/rgb.js";
import { SPACE } from "../text/chars.js";
import { frameTab } from "./frames.js";
import { CHIP_TINT, plainLabel, textOnFill } from "./labels.js";
import { BACKGROUND } from "./tokens.js";
import { firstInk, pageOf } from "./mix.js";
import { type Theme } from "./theme-model.js";

export function chipStyle(th: Theme, ink: string): string {
  const named = th.variables.edgeLabelBackground;
  const ground = themeRgb(named);
  if (ground === undefined) return ink;
  return textOnFill(ink, ground).trim();
}

const FLUSH_ON_LEFT: ReadonlySet<string> = new Set([BLOCK.rightEighth, BLOCK.rightHalf]);

const FLUSH_ON_RIGHT: ReadonlySet<string> = new Set([BLOCK.leftEighth, BLOCK.leftHalf]);

type Cells = ReadonlyArray<readonly [string, string]>;

// A blank a chip may take for its padding: the page, or the ground of the frame it stands in, whichever frame it is.
const padsOn = (key: string): boolean => key === DEFAULT_STYLE || key === COMPOSITE_TITLE_FILL || FRAME_FILLS.has(key);

function takesPad(row: Cells, at: number, away: -1 | 1): boolean {
  const cell = row[at];
  if (cell === undefined || cell[0] !== SPACE || !padsOn(cell[1])) return false;
  const beyond = row[at + away];
  return beyond === undefined || !(away === 1 ? FLUSH_ON_RIGHT : FLUSH_ON_LEFT).has(beyond[0]);
}

export function chipPadKey(row: Cells, at: number, key: string): string {
  if (!padsOn(key) || row[at][0] !== SPACE) return key;
  for (const away of [1, -1] as const) {
    const beside = row[at - away];
    if (beside === undefined || beside[0] === SPACE || !isChip(beside[1])) continue;
    if (!takesPad(row, at, away)) return key;
    let far = at - away;
    while (row[far - away]?.[1] === beside[1]) far -= away;
    return takesPad(row, far - away, away === 1 ? -1 : 1) ? beside[1] : key;
  }
  return key;
}

export const edgeChip = (th: Theme): string => {
  const words = th.chipLabel ?? plainLabel(th);
  if (th.variables.edgeLabelBackground !== undefined) return chipStyle(th, words);
  const primary = firstInk(th.node);
  if (primary === undefined) return frameTab(th);
  const page = pageOf(th);
  const mixed = {
    r: Math.round(page.r + (primary.r - page.r) * CHIP_TINT),
    g: Math.round(page.g + (primary.g - page.g) * CHIP_TINT),
    b: Math.round(page.b + (primary.b - page.b) * CHIP_TINT),
  };
  return `${words} ${BACKGROUND}${formatHex(mixed)}`;
};
