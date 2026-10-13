import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { DOWN, LEFT, RIGHT, UP } from "../../canvas/merge.js";
import { type Branch, branchesOf, edgeKey, trunkKey } from "./sections.js";
import { type Chars, type StemArms, labelBlock, nearestChild, painted, stemArms, widthOf } from "./rows.js";

// A drawing and the cell of it a parent's line comes in on.
export interface Tile {
  readonly canvas: Canvas;
  readonly row: number;
  readonly col: number;
}

// Siblings laid side by side keep one blank column between them.
const SIBLING_GAP = 1;
// The root's own branches side by side keep this many more, so each change of branch reads as one.
const BRANCH_GAP = 4;
// How far off the middle a child's line may stand and still take the stem.
const SNAP_REACH = 3;

const widthOfTile = (tile: Tile): number => tile.canvas.width;

// Children side by side on a bar, the stem to the parent leaving it from the middle: above the parent when `up`, the
// children standing on the bar, below it otherwise, hanging from it.
export function fan(tiles: readonly Tile[], children: readonly Branch[], ch: Chars, up: boolean, apart = false): Tile {
  const gap = SIBLING_GAP + ch.spread + (apart ? BRANCH_GAP : 0);
  const height = Math.max(...tiles.map((tile) => tile.canvas.height));
  const lefts: number[] = [];
  tiles.forEach((_tile, at) => lefts.push(at === 0 ? 0 : lefts[at - 1] + widthOfTile(tiles[at - 1]) + gap));
  const width = lefts[lefts.length - 1] + widthOfTile(tiles[tiles.length - 1]);
  // A lone child needs no bar: its line is the stem.
  const rise = tiles.length === 1 ? 1 : 2;
  const bar = up ? height : 1;
  const stem = up ? height + rise - 1 : 0;
  const canvas = new Canvas(width, height + rise);
  tiles.forEach((tile, at) => canvas.stamp(tile.canvas, up ? height - tile.canvas.height : rise, lefts[at], true));
  const ends = tiles.map((tile, at) => lefts[at] + tile.col);
  const first = ends[0];
  const last = ends[ends.length - 1];
  // The stem leaves from the middle, on the middle child's own line where there is one, or on the line of a child it
  // would stand a few columns from, so no two marks stand huddled together.
  const halfway = Math.floor((first + last) / 2);
  const near = [...ends].sort((a, b) => Math.abs(a - halfway) - Math.abs(b - halfway))[0];
  const mid = ends[(ends.length - 1) / 2] ?? (Math.abs(near - halfway) <= SNAP_REACH ? near : halfway);
  const trunk = trunkKey(children);
  // Each cell of the bar inked for the child it leads on to, the nearest on its side of the stem.
  const owner = (col: number): string => {
    if (col === mid) return trunk;
    return edgeKey(children[nearestChild(ends, col, mid)].seat);
  };
  if (rise === 1) {
    canvas.put(stem, mid, ch.v, false, edgeKey(children[0].seat));
    return { canvas, row: stem, col: mid };
  }
  const arms: StemArms = { before: LEFT, after: RIGHT, child: up ? UP : DOWN, parent: up ? DOWN : UP };
  for (let col = first; col <= last; col++) {
    canvas.put(bar, col, ch.armed(stemArms(arms, col, first, last, ends.includes(col), col === mid)), false, owner(col));
  }
  canvas.put(stem, mid, ch.v, false, trunk);
  return { canvas, row: stem, col: mid };
}

// A node with its children fanned above it (`up`) or below it, the whole facing away from its parent.
export function subtreeVertical(branch: Branch, ch: Chars, up: boolean): Tile {
  const label = labelBlock(branch, ch);
  const face = painted(label.rows);
  const labelWidth = widthOf(label);
  const centre = Math.floor(labelWidth / 2);
  const height = label.rows.length;
  const children = branchesOf(branch);
  if (children.length === 0) return { canvas: face, row: up ? height - 1 : 0, col: centre };
  const group = fan(children.map((child) => subtreeVertical(child, ch, up)), children, ch, up);
  const groupAt = Math.max(0, centre - group.col);
  const labelAt = Math.max(0, group.col - centre);
  const canvas = new Canvas(Math.max(EMPTY_SIZE, groupAt + group.canvas.width, labelAt + face.width), group.canvas.height + height);
  canvas.stamp(group.canvas, up ? 0 : height, groupAt, true);
  canvas.stamp(face, up ? group.canvas.height : 0, labelAt, true);
  return { canvas, row: up ? group.canvas.height + height - 1 : 0, col: labelAt + centre };
}
