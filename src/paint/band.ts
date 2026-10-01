import { RULE_RATIO, readableStyle } from "../colour/contrast.js";
import { parseHex } from "../colour/rgb.js";
import { SPACE } from "../text/chars.js";
import { isFill } from "./mix.js";
import { hasGround } from "./style.js";
import { EMPTY } from "./tokens.js";
import { ensured } from "../must.js";

export type OverFill = (fill: string, definition: string, rule: boolean) => string;

// An ink kept readable over a fill a key's band names, worked out once per fill and ink.
export function overFills(): OverFill {
  const readable = new Map<string, Map<string, string>>();
  return (fill, definition, rule) => {
    const known = ensured(readable, fill, () => new Map<string, string>());
    const asked = (rule ? RULE_RATIO : EMPTY) + SPACE + definition;
    const seen = known.get(asked);
    if (seen !== undefined) return seen;
    const ground = parseHex(fill);
    const fixed =
      ground === undefined
        ? definition
        : rule
          ? readableStyle(definition, ground, RULE_RATIO, RULE_RATIO)
          : readableStyle(definition, ground);
    known.set(asked, fixed);
    return fixed;
  };
}

// A cell whose own style lays a ground keeps it over a fill band: a node's fill, an edge label's chip.
export const keepsOwnGround = (style: string | undefined, tail: string): style is string =>
  style !== undefined && hasGround(style) && isFill(tail);

// A cell under a band, in every drawing alike: the band's ground, and over it the cell's own ink, kept readable when
// the band is a fill and the ink is the theme's. A blank shows the ground alone unless its key keeps it.
export function laidOnBand(
  over: OverFill,
  style: string | undefined,
  ch: string,
  tail: string,
  band: string,
  inked: boolean,
  rule: boolean,
  keepBlank: boolean
): string {
  const own = style && (ch !== SPACE || keepBlank) ? style : EMPTY;
  const fg = isFill(tail) && ch !== SPACE && !inked ? over(tail, own, rule) : own;
  return `${fg} ${band}`.trim();
}
