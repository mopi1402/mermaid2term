import { CRIT, CRIT_BORDER, GANTT_AXIS_TEXT, GANTT_GRID, GANTT_INSIDE_PREFIX, GANTT_SECTION_TITLE_PREFIX, GANTT_TASK, GANTT_TITLE, TASK_ACTIVE, TASK_DONE } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

const BARS: ReadonlySet<string> = new Set([GANTT_TASK, TASK_DONE, TASK_ACTIVE, CRIT, CRIT_BORDER]);
const inside = (key: string): boolean => key.startsWith(GANTT_INSIDE_PREFIX);

// Measured on mermaid 12.0.0 headless: `.task` reaches every bar, done and critical ones included, `.taskText` a name
// written on its bar, `.sectionTitle` and `.titleText` the titles, `.grid .tick` the grid, `.grid .tick text` the dates.
export const GANTT_SELECTORS: readonly KindSelector[] = [
  { selectors: [".task"], keys: (key) => BARS.has(key), fill: "ink" },
  { selectors: [".task"], keys: inside, fill: "ground" },
  { selectors: [".taskText"], keys: inside, fill: "ink" },
  { selectors: [".sectionTitle"], keys: (key) => key.startsWith(GANTT_SECTION_TITLE_PREFIX), fill: "ink" },
  { selectors: [".titleText"], keys: (key) => key === GANTT_TITLE, fill: "ink" },
  { selectors: [".grid .tick"], keys: (key) => key === GANTT_GRID, fill: "ink" },
  { selectors: [".grid .tick text"], keys: (key) => key === GANTT_AXIS_TEXT, fill: "ink" },
];
