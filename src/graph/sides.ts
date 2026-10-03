import { Direction, isHorizontal } from "./model.js";
import type { GridLayout } from "./layout/grid.js";
import type { NodePlacement } from "./layout/laid.js";
import { membersOf } from "./subgraph-tree.js";

export enum AttachDir {
  TOP = "TOP",
  BOTTOM = "BOTTOM",
  LEFT = "LEFT",
  RIGHT = "RIGHT",
}

export const SELF_LOOP_SIDES: readonly [AttachDir, AttachDir] = [AttachDir.TOP, AttachDir.RIGHT];

export function gapBetweenIsClear(src: NodePlacement, tgt: NodePlacement, layout: GridLayout): boolean {
  const sc = src.grid.col;
  const sr = src.grid.row;
  const tc = tgt.grid.col;
  const tr = tgt.grid.row;
  // A box's own members stand inside it, where the run is clipped at its rule before reaching them.
  const own = new Set([src.nodeId, tgt.nodeId]);
  for (const end of [src, tgt]) {
    const frame = layout.frameOf(end.nodeId);
    if (frame !== undefined) for (const id of membersOf(frame.subgraph)) own.add(id);
  }
  if (tc === sc && tr < sr) {
    for (let r = tr + 1; r < sr; r++) if (!layout.isFree(sc, r, own)) return false;
    return true;
  }
  if (tr === sr && tc < sc) {
    for (let c = tc + 1; c < sc; c++) if (!layout.isFree(c, sr, own)) return false;
    return true;
  }
  return false;
}

// The sides facing along a flow and across it, the ahead ones toward growing coordinates.
interface FlowSides {
  readonly ahead: AttachDir;
  readonly behind: AttachDir;
  readonly crossAhead: AttachDir;
  readonly crossBehind: AttachDir;
}

const ACROSS_COLUMNS: FlowSides = { ahead: AttachDir.RIGHT, behind: AttachDir.LEFT, crossAhead: AttachDir.BOTTOM, crossBehind: AttachDir.TOP };
const ACROSS_ROWS: FlowSides = { ahead: AttachDir.BOTTOM, behind: AttachDir.TOP, crossAhead: AttachDir.RIGHT, crossBehind: AttachDir.LEFT };

export function determineDirections(
  src: NodePlacement,
  tgt: NodePlacement,
  direction: Direction,
  gapClear = false
): Array<[AttachDir, AttachDir]> {
  const horizontal = isHorizontal(direction);
  const { ahead, behind, crossAhead, crossBehind } = horizontal ? ACROSS_COLUMNS : ACROSS_ROWS;
  const [sf, sx] = horizontal ? [src.grid.col, src.grid.row] : [src.grid.row, src.grid.col];
  const [tf, tx] = horizontal ? [tgt.grid.col, tgt.grid.row] : [tgt.grid.row, tgt.grid.col];

  let preferred: [AttachDir, AttachDir];
  if (tf > sf) preferred = [ahead, behind];
  else if (tf < sf) {
    const straight: Array<[AttachDir, AttachDir]> = gapClear ? [[behind, ahead]] : [];
    // A vertical flow may also go back round the left, a horizontal one only below.
    const farSide: Array<[AttachDir, AttachDir]> = horizontal ? [] : [[crossBehind, crossBehind], [crossBehind, crossAhead]];
    return tx === sx
      ? [...straight, [crossAhead, crossAhead], [crossAhead, crossBehind], ...farSide]
      : [[crossAhead, crossAhead], [crossAhead, crossBehind], [crossAhead, ahead]];
  } else preferred = tx > sx ? [crossAhead, crossBehind] : [crossBehind, crossAhead];

  let alt: [AttachDir, AttachDir];
  if (tx > sx) alt = [crossAhead, crossBehind];
  else if (tx < sx) alt = [crossBehind, crossAhead];
  else alt = preferred;
  // A box ahead and aside may also be reached round the outside, on the side both face it from.
  if (tf > sf && tx !== sx) return [preferred, alt, [alt[0], alt[0]]];
  return [preferred, alt];
}

export function preferredSides(src: NodePlacement, tgt: NodePlacement, layout: GridLayout, direction: Direction): [AttachDir, AttachDir] {
  return determineDirections(src, tgt, direction, gapBetweenIsClear(src, tgt, layout))[0];
}
