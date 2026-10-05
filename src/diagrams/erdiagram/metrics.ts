import { DEFAULT_GAP } from "../../options.js";
import { NUL } from "../../text/chars.js";
import { Direction } from "../../graph/model.js";

export const PAD = 2;

export const MIN_BOX_WIDTH = 16;

export const STACK_GAP = 2;

export const MARGIN = 0;

export const BASE_CROSS_GAP = 4;

const LABEL_ROOM = 4;

export const EXIT_SPREAD = 3;

export const MIN_EDGE_GAP = 4;

export const FLOOR_STEP = 4;

export const LABEL_AIR = 2;

export const labelRoom = (gap: number): number => (gap >= DEFAULT_GAP ? LABEL_ROOM : gap > 1 ? 2 : 0);

export const CELL_COUNT = 4;

export const TRAILING_BLANKS_RE = /\s+$/;

export const { LR, RL, BT } = Direction;

export const KEY_SEP = NUL;

const AIRY_HEIGHT = 4;

export const sideRow = (y: number, h: number): number => y + (h === AIRY_HEIGHT ? 1 : Math.floor(h / 2));

export const MIN_STRIDE = 4;

export const CORRIDOR_STEP = 3;

export const STRAIGHT_PULL = 3;

export const MARKER_ALONG = 1;
export const MARKER_ACROSS = 3;
// From one marker's middle to the next on one face: down the page a single blank column reads as a single bar.
export const markerStride = (isLR: boolean): number => MARKER_ACROSS + (isLR ? 1 : 3);

export const TYPE_PIPE = "|";

export function clampOffset(off: number, extent: number): number {
  const room = Math.max(0, Math.floor((extent - 3) / 2));
  return Math.max(-room, Math.min(room, off));
}

const HALF_FIGURE = Math.floor(MARKER_ACROSS / 2);

// A face read along columns keeps each figure a column clear of the corner past it.
export const seatsAcross = (off: number, width: number): boolean =>
  Math.floor(width / 2) + off - HALF_FIGURE >= 2 && Math.floor(width / 2) + off + HALF_FIGURE <= width - 3;

export function clampAcross(off: number, width: number): number {
  const mid = Math.floor(width / 2);
  return Math.max(Math.min(0, 2 + HALF_FIGURE - mid), Math.min(Math.max(0, width - 3 - HALF_FIGURE - mid), off));
}

export const SIDE_SIDE = "side";

// What mermaid's `rankSpacing`, and a `nodeSpacing` running down the page, change in the ER layout: the columns
// between ranks in LR, left to the one gap when unsaid, and the rows added between ranks in TD and between the
// entities of one rank in LR.
export interface RankSpacing {
  gap: number | undefined;
  rankRows: number;
  stackRows: number;
}
export const NO_RANK_SPACING: RankSpacing = { gap: undefined, rankRows: 0, stackRows: 0 };
