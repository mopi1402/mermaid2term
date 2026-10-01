import { words } from "../text/format.js";

// A style is words: attributes, an ink, `on` before its ground, `not` before an attribute it takes back.
export const GROUND_WORD = "on";
export const NEGATION_WORD = "not";

// A written definition's words, however it spaces them.
export const definitionWords = (definition: string): string[] => words(definition);
