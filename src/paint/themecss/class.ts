import { ABSTRACT_LABEL, BOLD_LABEL, EDGE, EDGE_CHIP, ITALIC_LABEL, NOTE_LABEL, PLAIN_LABEL, STATIC_LABEL_KEY } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

const BOX_WORDS: ReadonlySet<string> = new Set([BOLD_LABEL, ITALIC_LABEL, PLAIN_LABEL, ABSTRACT_LABEL, STATIC_LABEL_KEY]);

// Measured on mermaid 12.0.0 headless: `.relation` strokes every line, `.markdown-node-label` colours a class box's
// words, `.noteLabel .nodeLabel` a note's and `.edgeLabel .label span` a relation label's.
export const CLASS_SELECTORS: readonly KindSelector[] = [
  { selectors: [".relation"], keys: (key) => key === EDGE, fill: "ground" },
  { selectors: [".markdown-node-label"], keys: (key) => BOX_WORDS.has(key), fill: "ink" },
  { selectors: [".noteLabel .nodeLabel"], keys: (key) => key === NOTE_LABEL, fill: "ink" },
  { selectors: [".edgeLabel .label span"], keys: (key) => key === EDGE_CHIP, fill: "ink" },
];
