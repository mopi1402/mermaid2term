import { EDGE, EDGE_CHIP, LABEL, PLAIN_LABEL, PLAIN_LABEL_STRIPE } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

const WORDS: ReadonlySet<string> = new Set([LABEL, PLAIN_LABEL, PLAIN_LABEL_STRIPE, EDGE_CHIP]);

// Measured on mermaid 12.0.0 headless: `.relationshipLine` strokes every line, `.labelBkg` colours a relationship's
// label and `.label` every word the drawing writes.
export const ER_SELECTORS: readonly KindSelector[] = [
  { selectors: [".relationshipLine"], keys: (key) => key === EDGE, fill: "ground" },
  { selectors: [".labelBkg"], keys: (key) => key === EDGE_CHIP, fill: "ink" },
  { selectors: [".label"], keys: (key) => WORDS.has(key), fill: "ink" },
];
