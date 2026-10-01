import { GROUND_WORD } from "../colour/style-words.js";
import { SPACE } from "../text/chars.js";
import { BACKGROUND, EMPTY, REVERSE } from "./tokens.js";

export const without = (style: string, word: string): string => style.split(SPACE).filter((said) => said !== word).join(SPACE);

export const inked = (weight: string, ink: string | undefined): string =>
  [weight, ink].filter((word) => word !== undefined && word !== EMPTY).join(SPACE);

export const hasGround = (style: string): boolean => {
  const padded = SPACE + style + SPACE;
  return padded.includes(SPACE + BACKGROUND) || padded.includes(SPACE + REVERSE + SPACE);
};

// The ground a style's last `on` names.
export const lastGround = (style: string): string | undefined => {
  const at = style.lastIndexOf(BACKGROUND);
  return at === -1 ? undefined : style.slice(at + BACKGROUND.length);
};

// The style with its ground replaced, the new one last.
export const grounded = (style: string, ground: string): string => {
  const words = style.split(SPACE).filter((word) => word !== EMPTY);
  const at = words.indexOf(GROUND_WORD);
  const kept = at === -1 ? words : [...words.slice(0, at), ...words.slice(at + 2)];
  return [...kept, GROUND_WORD, ground].join(SPACE);
};
