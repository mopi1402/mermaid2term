import { LABEL_BOX, LOOP_LABEL, SIGNAL_LABEL } from "../../canvas/keys.js";
import { type KindSelector, type Unread } from "./model.js";

// On mermaid 12's sequence text neither `color` nor `font-weight` shows.
const TEXT_UNREAD: readonly Unread[] = ["color", "bold"];

// Measured on mermaid 12.0.0 headless: `.messageText` inks a message's label, `.labelText` a block's keyword,
// `.labelBox` fills its tab, which the condition shares here.
export const SEQUENCE_SELECTORS: readonly KindSelector[] = [
  { selectors: [".messageText"], keys: (key) => key === SIGNAL_LABEL, fill: "ink", unread: TEXT_UNREAD },
  { selectors: [".labelText"], keys: (key) => key === LABEL_BOX, fill: "ink", unread: TEXT_UNREAD },
  { selectors: [".labelBox"], keys: (key) => key === LABEL_BOX || key === LOOP_LABEL, fill: "ground", unread: ["stroke", "color", "font"] },
];
