import { RIM_TAIL, SECTION_PREFIX, indexed } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

// mermaid numbers columns from 1 with no wrap; more than this many never fit a terminal's width.
export const COLUMNS_READ = 64;

// Measured on mermaid 12.0.0 headless: `.section-N rect` fills column N's box past mermaid's own sheet, where
// `.section-N`, `.node` and `.label-container` lose to it.
export const KANBAN_SELECTORS: readonly KindSelector[] = Array.from({ length: COLUMNS_READ }, (_, i) => ({
  selectors: [`.section-${i + 1} rect`],
  keys: (key: string) => key === indexed(SECTION_PREFIX, i) || key === indexed(SECTION_PREFIX, i) + RIM_TAIL,
  fill: "ground",
}));
