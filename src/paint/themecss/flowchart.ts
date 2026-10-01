import { ARROW, EDGE, SUBGRAPH_LABEL } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

// Measured on mermaid 12.0.0 headless: every edge wears `.edge-pattern-solid`, dotted and thick ones included, and it
// strokes the line, not its head.
export const SOLID_EDGE: KindSelector = { selectors: [".edge-pattern-solid"], keys: (key) => key === EDGE, fill: "none" };

// Measured on mermaid 12.0.0 headless: `.arrowMarkerPath` fills and strokes every head, `.cluster span` inks a
// subgraph's title.
export const FLOWCHART_SELECTORS: readonly KindSelector[] = [
  SOLID_EDGE,
  { selectors: [".arrowMarkerPath"], keys: (key) => key === ARROW, fill: "ink" },
  { selectors: [".cluster span"], keys: (key) => key === SUBGRAPH_LABEL, fill: "none" },
];
