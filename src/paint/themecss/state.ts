import { COMPOSITE, EDGE, FILL_TAIL, LABEL, NODE, NOTE_LABEL } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

const NAME = NODE + COMPOSITE + LABEL;
const BOX: ReadonlySet<string> = new Set([NODE + FILL_TAIL, NAME]);

// Measured on mermaid 12.0.0 headless: `.transition` strokes every line, `.node rect` fills a state's box,
// `.markdown-node-label` colours a state's name and `.statediagram-note .nodeLabel` a note's words.
export const STATE_SELECTORS: readonly KindSelector[] = [
  { selectors: [".transition"], keys: (key) => key === EDGE, fill: "ground" },
  { selectors: [".node rect"], keys: (key) => BOX.has(key), fill: "ground" },
  { selectors: [".markdown-node-label"], keys: (key) => key === NAME, fill: "ink" },
  { selectors: [".statediagram-note .nodeLabel"], keys: (key) => key === NOTE_LABEL, fill: "ink" },
];
