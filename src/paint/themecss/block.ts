import { EDGE_HEAD } from "../../canvas/keys.js";
import { SOLID_EDGE } from "./flowchart.js";
import { type KindSelector } from "./model.js";

// Measured on mermaid 12.0.0 headless: a link wears `.edge-pattern-solid` as a flowchart edge does, which strokes the
// line and leaves its head in `lineColor`; `.arrowMarkerPath` and `.marker` fill and stroke every head.
export const BLOCK_SELECTORS: readonly KindSelector[] = [
  SOLID_EDGE,
  { selectors: [".arrowMarkerPath", ".marker"], keys: (key) => key === EDGE_HEAD, fill: "ink" },
];
