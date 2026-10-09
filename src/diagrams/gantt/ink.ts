import { CRIT, GANTT_BAND_PREFIX, GANTT_GRID, GANTT_MILESTONE, GANTT_SECTION_TITLE_PREFIX, MARKER, RULE, TASK_DONE, TODAY, indexed } from "../../canvas/keys.js";

export const STYLE_VERT = MARKER;
export const STYLE_TODAY = TODAY;
export const STYLE_GRID = GANTT_GRID;
export const STYLE_MILESTONE = GANTT_MILESTONE;
export const STYLE_RULE = RULE;
export const STYLE_CRIT = CRIT;
export const STYLE_DONE = TASK_DONE;
export const sectionLabelStyle = (index: number): string => indexed(GANTT_SECTION_TITLE_PREFIX, index);
export const sectionBand = (index: number): string => indexed(GANTT_BAND_PREFIX, index);
