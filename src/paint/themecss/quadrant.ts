import { QUADRANT_FILL, QUADRANT_POINT, QUADRANT_POINT_TEXT, QUADRANT_TEXT, QUADRANT_TITLE, QUADRANT_X_LABEL, QUADRANT_Y_LABEL } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

const onQuadrant = (key: string): boolean => [QUADRANT_FILL, QUADRANT_TEXT, QUADRANT_POINT].some((prefix) => key.startsWith(prefix));
const point = (key: string): boolean => key.startsWith(QUADRANT_POINT) && !key.startsWith(QUADRANT_POINT_TEXT);

// Measured on mermaid 12.0.0 headless: a rule on a bare group reaches only a point's dot, when the point states no
// colour; `.quadrant rect`, `.quadrant text`, `.data-point text`, `.label text` and `.title text` reach the rest.
export const QUADRANT_SELECTORS: readonly KindSelector[] = [
  { selectors: [".quadrant rect"], keys: onQuadrant, fill: "ground" },
  { selectors: [".quadrant text"], keys: (key) => key.startsWith(QUADRANT_TEXT), fill: "ink" },
  { selectors: [".data-point", ".data-points", ".data-point circle"], keys: point, fill: "ink" },
  { selectors: [".data-point text"], keys: (key) => key.startsWith(QUADRANT_POINT_TEXT), fill: "ink" },
  { selectors: [".label text"], keys: (key) => key === QUADRANT_X_LABEL || key === QUADRANT_Y_LABEL, fill: "ink" },
  { selectors: [".title text"], keys: (key) => key === QUADRANT_TITLE, fill: "ink" },
];
