import { ARROW, COMPOSITE, EDGE, LABEL, NODE, SLAB_TAIL, SUBGRAPH, SUBGRAPH_LABEL, WALL_TAIL } from "../../canvas/keys.js";
import { type KindSelector } from "./model.js";

const SERVICE_NAME = `${NODE}${COMPOSITE}${LABEL}`;
const GROUP_FRAME: ReadonlySet<string> = new Set([SUBGRAPH, SUBGRAPH + WALL_TAIL, SUBGRAPH + SLAB_TAIL]);

// Measured on mermaid 12.0.0 headless: `.architecture-service` and `.architecture-services` fill a service's name,
// `.node-bkg` strokes a group's frame, `.architecture-groups` fills a group's name, `.edge` strokes an edge and
// `.arrow` fills its head. A service's name keeps its weight and style, which its inner `tspan` sets back to normal,
// and takes the underline.
export const ARCHITECTURE_SELECTORS: readonly KindSelector[] = [
  { selectors: [".architecture-service", ".architecture-services"], keys: (key) => key === SERVICE_NAME, fill: "ink", unread: ["bold", "italic"] },
  { selectors: [".node-bkg"], keys: (key) => GROUP_FRAME.has(key), fill: "none" },
  { selectors: [".architecture-groups"], keys: (key) => key === SUBGRAPH_LABEL, fill: "ink" },
  { selectors: [".edge"], keys: (key) => key === EDGE, fill: "none" },
  { selectors: [".arrow"], keys: (key) => key === ARROW, fill: "ink" },
];
