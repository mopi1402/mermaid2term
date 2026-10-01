import { LABEL, NODE } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

// Measured on mermaid 12.0.0 headless: `.packetBlock` strokes a field's box, `.packetLabel` fills its name.
export const PACKET_SELECTORS: readonly KindSelector[] = [
  { selectors: [".packetBlock"], keys: (key) => key === NODE, fill: "none" },
  { selectors: [".packetLabel"], keys: (key) => key === LABEL, fill: "ink" },
];
