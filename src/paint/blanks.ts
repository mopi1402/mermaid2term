import {
  CLASS_PREFIX, COMPOSITE_ALT_FILL, COMPOSITE_BODY_FILL, COMPOSITE_TITLE_FILL, EDGE_CHIP, FILL_TAIL, FRAME_TAB, GANTT_INSIDE_PREFIX, GIT_TAG, LABEL_BOX,
  LOOP_LABEL, NODE_COMPOSITE, NODE_STYLE_PREFIX, NOTE_FILL, QUADRANT_PREFIX, RIM_TAIL, SECTION_PREFIX, STATIC_LABEL_KEY, STRIPE, SUBGRAPH_FILL, TREEMAP_PREFIX, isChip,
} from "../canvas/keys.js";
import { isActorKey } from "./labels.js";
import { hasGround } from "./style.js";

const GROUND_KEYS: ReadonlySet<string> = new Set([
  NOTE_FILL, SUBGRAPH_FILL, COMPOSITE_TITLE_FILL, COMPOSITE_BODY_FILL, COMPOSITE_ALT_FILL, STRIPE, FRAME_TAB, LABEL_BOX, LOOP_LABEL, EDGE_CHIP, GIT_TAG,
]);
const GROUND_PREFIXES = [SECTION_PREFIX, GANTT_INSIDE_PREFIX, CLASS_PREFIX, NODE_STYLE_PREFIX, NODE_COMPOSITE, QUADRANT_PREFIX, TREEMAP_PREFIX];

const laysGround = (key: string): boolean =>
  GROUND_KEYS.has(key) ||
  GROUND_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
  isChip(key) ||
  isActorKey(key, FILL_TAIL) ||
  isActorKey(key, RIM_TAIL);

// Whether a blank cell under this key is painted, in every drawing alike: a key that lays a ground shows it on its
// blanks, and a static member's underline runs across them. Anything else on a blank shows nothing.
export const blankPainted = (key: string, style: string, chip = false): boolean =>
  key === STATIC_LABEL_KEY || ((chip || laysGround(key)) && hasGround(style));
