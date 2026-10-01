import { SECTION_BACKGROUND_PREFIX, indexAfter } from "../../canvas/keys.js";
import { type KindSelector, type Unread } from "./model.js";

// mermaid 12 numbers a task's `.task-type-N` by its section, over seven.
const TASK_TYPES = 7;
// A task's border and name share their key with its section's header here, so only its fill reaches the task alone.
const FILL_ONLY: readonly Unread[] = ["stroke", "color", "font"];

// A header's band is the section's wash too, which mermaid's `.task` rules never reach.
const sectionOf = (key: string): number | undefined => indexAfter(key, SECTION_BACKGROUND_PREFIX);

// Measured on mermaid 12.0.0 headless: `.task` fills every task's box, `.task-type-N` those of section N.
export const JOURNEY_SELECTORS: readonly KindSelector[] = [
  { selectors: [".task"], keys: (key) => sectionOf(key) !== undefined, fill: "ground", unread: FILL_ONLY },
  ...Array.from({ length: TASK_TYPES }, (_, type): KindSelector => ({
    selectors: [`.task-type-${type}`],
    keys: (key) => {
      const section = sectionOf(key);
      return section !== undefined && section % TASK_TYPES === type;
    },
    fill: "ground",
    unread: FILL_ONLY,
  })),
];
