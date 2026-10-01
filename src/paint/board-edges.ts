import { DEEP_SUFFIX, OUT_TAIL, SECTION_PREFIX, SLAB_TAIL } from "../canvas/keys.js";
import { slabInk } from "./mix.js";
import { BACKGROUND, EMPTY } from "./tokens.js";

// A style's ground, `on #hex`, and the ink before it.
const groundOf = (style: string): string | undefined => (style.includes(BACKGROUND) ? style.slice(style.lastIndexOf(BACKGROUND)) : undefined);
const inkOf = (style: string): string => (style.includes(BACKGROUND) ? style.slice(0, style.lastIndexOf(BACKGROUND)) : style).trim();

// A kanban column's outline and a card's once the border mode moves them: a padless rule stands outside its box, its
// ink on the ground the box stands on, and a borderless slab is the box's ground inked on that same one.
export function boardEdgeStyles(index: number, band: string, rim: string, cardRim: string, cardGround: string): Array<[string, string]> {
  const column = `${SECTION_PREFIX}${index}`;
  const card = `${column}${DEEP_SUFFIX}`;
  const onColumn = groundOf(band) ?? EMPTY;
  return [
    [`${column}${OUT_TAIL}`, inkOf(rim)],
    [`${column}${SLAB_TAIL}`, slabInk(groundOf(band), inkOf(band))],
    [`${card}${OUT_TAIL}`, `${inkOf(cardRim)} ${onColumn}`.trim()],
    [`${card}${SLAB_TAIL}`, `${cardGround} ${onColumn}`.trim()],
  ];
}
