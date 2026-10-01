import { ACROSS_RUNS, ARC, BOX, DOWN_RUNS } from "./alphabet.js";
import { CHARSETS } from "./charsets.js";

export interface Feed {
  readonly dr: number;
  readonly dc: number;
  readonly allowed: ReadonlySet<string>;
}

// A head is fed by a shaft of its own: a tee or a box wall right behind it leaves the arrow a single cell.
const FEED_DOWN: Feed = {
  dr: -1,
  dc: 0,
  allowed: new Set([...DOWN_RUNS, BOX.lightUpHeavyDown, ARC.topLeft, ARC.topRight, BOX.heavyTopLeft, BOX.heavyTopRight, BOX.cross]),
};
const FEED_UP: Feed = {
  dr: 1,
  dc: 0,
  allowed: new Set([...DOWN_RUNS, BOX.heavyUpLightDown, ARC.bottomLeft, ARC.bottomRight, BOX.heavyBottomLeft, BOX.heavyBottomRight, BOX.cross]),
};
const FEED_RIGHT: Feed = {
  dr: 0,
  dc: -1,
  allowed: new Set([...ACROSS_RUNS, ARC.bottomLeft, ARC.topLeft, BOX.heavyBottomLeft, BOX.heavyTopLeft, BOX.cross]),
};
const FEED_LEFT: Feed = {
  dr: 0,
  dc: 1,
  allowed: new Set([...ACROSS_RUNS, ARC.bottomRight, ARC.topRight, BOX.heavyBottomRight, BOX.heavyTopRight, BOX.cross]),
};
export const HEADS: ReadonlyMap<string, Feed> = new Map<string, Feed>(
  [...CHARSETS.values()].flatMap((cs) => [
    [cs.arrowDown, FEED_DOWN],
    [cs.arrowUp, FEED_UP],
    [cs.arrowRight, FEED_RIGHT],
    [cs.arrowLeft, FEED_LEFT],
  ])
);
