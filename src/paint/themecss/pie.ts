import { PIE_LEGEND_TEXT, PIE_SECTION_TEXT, PIE_SLICE_PREFIX, PIE_TITLE } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

// Measured on mermaid 12.0.0 headless: `.pieCircle` fills every slice, `.slice` its percentage, `.pieTitleText` the
// title and `.legend text` a legend label; a bare `.legend` loses to `.legend text` and to the swatch's inline fill.
export const PIE_SELECTORS: readonly KindSelector[] = [
  { selectors: [".pieCircle"], keys: (key) => key.startsWith(PIE_SLICE_PREFIX), fill: "ink" },
  { selectors: [".slice"], keys: (key) => key === PIE_SECTION_TEXT, fill: "ink" },
  { selectors: [".pieTitleText"], keys: (key) => key === PIE_TITLE, fill: "ink" },
  { selectors: [".legend text"], keys: (key) => key === PIE_LEGEND_TEXT, fill: "ink" },
];
