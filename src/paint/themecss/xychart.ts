import { XY_TITLE } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

// Measured on mermaid 12.0.0 headless: a rule on a bare group loses to the attributes below it, `.chart-title text`
// inks the title. The other descendant rules reach a part that shares its key here with another.
export const XY_CHART_SELECTORS: readonly KindSelector[] = [{ selectors: [".chart-title text"], keys: (key) => key === XY_TITLE, fill: "ink" }];
