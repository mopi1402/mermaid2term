import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import { type Mindmap } from "./model.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { blankCell, boxCells, inkedWidth, type Cell, type Edges } from "../../canvas/extent.js";
import { displayWidth, firstFitting } from "../../text/width.js";
import { run } from "./label.js";
import { type Branch, branchesOf, spreadSeats, trunkKey } from "./sections.js";
import { indentedRows } from "./tree.js";
import { type Block, type Chars, beside, joint, labelBlock, makeChars, painted, stackLeft, stackRight, subtreeRight, widthOf } from "./rows.js";
import { type Tile, fan, subtreeVertical } from "./vertical.js";

// The root's children, in their order, dealt round it clockwise from its right: right, below, left, above.
interface Sides {
  readonly top: Branch[];
  readonly right: Branch[];
  readonly bottom: Branch[];
  readonly left: Branch[];
  // Read clockwise, the left side runs up; a tidy tree reads both of its sides down.
  readonly leftUp: boolean;
}

// How many of the root's children the search deals above or below, each; past it a side's fan grows wider than useful.
const MOST_ACROSS = 4;

// A cell stands about twice as tall as it is wide.
const CELL_ASPECT = 2.2;
// A terminal has more columns than rows to spare, yet where no height presses a row costs little: the branches
// spread round the root.
const ROOMY = 4;
// The spreads tried past the tight one, the widest first, and the one used where no budget bounds the drawing.
const SPREADS = [2, 1];
const UNBOUND_SPREAD = 1;
// How much a root off the drawing's middle costs, against its size.
const CENTRE = 3;
// What each side of the root holding a branch is worth: a mind map spreads its branches all round.
const SIDE_BONUS = 40;
// What each row a stem runs through empty costs: a fan kept far from its root reads as cut off from it.
const STEM_COST = 4;

// Two blanks at least between a fan and the band beside it, so neither's line reads as the other's.
const CLEARANCE = 2;
// And one blank row between a fan and the band above or below it, so each bar reads as its own line.
const ROW_CLEARANCE = 1;

const inked = (canvas: Canvas, row: number, col: number): boolean => !blankCell(canvas, row, col);

// How many of the root's children each side holds.
interface Deal {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

function dealsOf(n: number): Deal[] {
  const out: Deal[] = [];
  for (let top = 0; top <= Math.min(n, MOST_ACROSS); top++) {
    for (let bottom = 0; bottom <= Math.min(n - top, MOST_ACROSS); bottom++) {
      // The right side tried fullest first, so a tie goes to the side a mind map reads first.
      for (let right = n - top - bottom; right >= 0; right--) {
        // The root's row fills first: a fan above or below only once both of its sides hold a branch.
        if (top + bottom > 0 && (right === 0 || right === n - top - bottom)) continue;
        out.push({ top, right, bottom, left: n - top - bottom - right });
      }
    }
  }
  return out;
}

const dealt = (children: readonly Branch[], { right, bottom, left }: Deal): Sides => ({
  right: children.slice(0, right),
  bottom: children.slice(right, right + bottom),
  left: children.slice(right + bottom, right + bottom + left),
  top: children.slice(right + bottom + left),
  leftUp: true,
});

// mermaid's tidy tree: the root's even branches on its left, its odd ones on its right, each side in source order.
const tidySides = (children: readonly Branch[]): Sides => ({
  top: [],
  bottom: [],
  left: children.filter((_child, at) => at % 2 === 0),
  right: children.filter((_child, at) => at % 2 === 1),
  leftUp: false,
});

// The root with its left and right stacks on its row, as the tree drew it before.
function band(root: Branch, sides: Sides, ch: Chars): { block: Block; at: number } {
  const label = labelBlock(root, ch);
  const withRight = sides.right.length === 0 ? label : beside(label, run(joint(ch), trunkKey(sides.right)), stackRight(sides.right, ch, true));
  if (sides.left.length === 0) return { block: withRight, at: 0 };
  const left = stackLeft(sides.leftUp ? [...sides.left].reverse() : sides.left, ch, true);
  return { block: beside(left, run(joint(ch), trunkKey(sides.left)), withRight), at: widthOf(left) + displayWidth(joint(ch)) };
}

const fanned = (branches: readonly Branch[], ch: Chars, up: boolean): Tile | undefined =>
  branches.length === 0 ? undefined : fan(branches.map((branch) => subtreeVertical(branch, ch, up)), branches, ch, up, true);

// Whether a tile set at `row`, `col` would land a cell on one already inked, within `CLEARANCE` columns of it or on the
// row next to it: a fan's bar never runs right against the band. Its stem alone may reach the root.
function clashes(on: Canvas, cells: readonly Cell[], row: number, col: number): boolean {
  for (const [r, c] of cells) {
    for (let dr = -ROW_CLEARANCE; dr <= ROW_CLEARANCE; dr++) {
      for (let dc = -CLEARANCE; dc <= CLEARANCE; dc++) if (inked(on, row + r + dr, col + c + dc)) return true;
    }
  }
  return false;
}

// The cells a tile inks, its stem's own left out: the only ones that can clash, read once for the whole slide.
const clashingCells = (tile: Tile): Cell[] =>
  [...boxCells({ top: 0, bottom: tile.canvas.height - 1, left: 0, right: tile.canvas.width - 1 })].filter(
    ([r, c]) => inked(tile.canvas, r, c) && !(r === tile.row && c === tile.col)
  );

interface Placed {
  readonly tile: Tile;
  readonly row: number;
  readonly col: number;
}

// The root's row on the band, the fans above and below it drawn down to it, each stem as short as keeps it clear.

// `heart` is where the root's label stands on the drawing: its first and last rows and columns.
function crossed(root: Branch, sides: Sides, ch: Chars): { canvas: Canvas; heart: Edges; stems: number } {
  const { block, at } = band(root, sides, ch);
  const middle = painted(block.rows);
  const label = labelBlock(root, ch);
  const centre = at + Math.floor(widthOf(label) / 2);
  const first = block.connect - label.connect;
  const last = first + label.rows.length - 1;
  const above = fanned(sides.top, ch, true);
  // And the bottom runs right to left.
  const below = fanned([...sides.bottom].reverse(), ch, false);
  let upper: Placed | undefined;
  if (above !== undefined) {
    let row = first - 1 - above.row;
    const cells = clashingCells(above);
    while (clashes(middle, cells, row, centre - above.col)) row--;
    upper = { tile: above, row, col: centre - above.col };
  }
  let lower: Placed | undefined;
  if (below !== undefined) {
    let row = last + 1;
    const cells = clashingCells(below);
    while (clashes(middle, cells, row, centre - below.col)) row++;
    lower = { tile: below, row, col: centre - below.col };
  }
  const placed = [upper, lower].filter((one) => one !== undefined);
  const top = Math.min(0, ...placed.map((one) => one.row));
  const leftmost = Math.min(0, ...placed.map((one) => one.col));
  const height = Math.max(middle.height, ...placed.map((one) => one.row + one.tile.canvas.height)) - top;
  const width = Math.max(middle.width, ...placed.map((one) => one.col + one.tile.canvas.width)) - leftmost;
  const canvas = new Canvas(Math.max(EMPTY_SIZE, width), Math.max(EMPTY_SIZE, height));
  canvas.stamp(middle, -top, -leftmost, true);
  for (const one of placed) canvas.stamp(one.tile.canvas, one.row - top, one.col - leftmost, true);
  if (upper !== undefined) {
    canvas.putColumn(centre - leftmost, upper.row + upper.tile.row + 1 - top, first - top, ch.v, false, trunkKey(sides.top));
  }
  if (lower !== undefined) {
    canvas.putColumn(centre - leftmost, last + 1 - top, lower.row - top, ch.v, false, trunkKey(sides.bottom));
  }
  // The rows a stem runs through past the one blank row a fan keeps from the band.
  const stems = (upper === undefined ? 0 : first - (upper.row + upper.tile.row) - 2) + (lower === undefined ? 0 : lower.row - last - 2);
  return { canvas, heart: { top: first - top, bottom: last - top, left: at - leftmost, right: at - leftmost + widthOf(label) - 1 }, stems };
}

// The width a drawing inks, a styled blank counted.
const inkedStyled = (canvas: Canvas): number => inkedWidth(canvas, inked);

// The fewest rows and columns a deal's drawing can take, read off its children once without drawing it: the rows of
// its taller side's stack, and the columns to its widest label's last ink.
function floorOf(root: Branch, children: readonly Branch[], ch: Chars): (deal: Deal) => { rows: number; width: number } {
  const label = labelBlock(root, ch);
  const gap = displayWidth(joint(ch));
  const labels = children.map((child) => labelBlock(child, ch));
  const widths = labels.map(widthOf);
  const summed = [0];
  for (const child of children) summed.push(summed[summed.length - 1] + subtreeRight(child, ch).rows.length);
  const firsts = [0];
  for (const block of labels) firsts.push(Math.max(firsts[firsts.length - 1], inkedStyled(painted(block.rows))));
  // The widest label from each child on to the one before the `top` last, for each count the top side can hold.
  const lasts = Array.from({ length: MOST_ACROSS + 1 }, (_lasts, top) => {
    const out = new Array<number>(children.length + 1).fill(0);
    for (let at = children.length - top - 1; at >= 0; at--) out[at] = Math.max(out[at + 1], widths[at]);
    return out;
  });
  // Siblings on the root's own sides stand a blank row apart.
  const stacked = (from: number, count: number): number => (count === 0 ? 0 : summed[from + count] - summed[from] + count - 1);
  const rootInk = inkedStyled(painted(label.rows));
  return ({ top, right, bottom, left }) => {
    const before = left === 0 ? 0 : lasts[top][right + bottom] + gap;
    const rows = Math.max(label.rows.length, stacked(0, right), stacked(right + bottom, left));
    return { rows, width: Math.max(before + rootInk, right === 0 ? 0 : before + widthOf(label) + gap + firsts[right]) };
  };
}

// The deal with its colours spread round it, the branches in the order they stand clockwise from the right.
function seated(sides: Sides, sources: readonly Branch[]): Sides {
  const round = [...sides.right, ...sides.bottom, ...sides.left, ...sides.top];
  const seats = spreadSeats(sources, round);
  const reseat = (side: readonly Branch[]): Branch[] => side.map((branch) => ({ ...branch, seat: seats.get(branch.node) ?? branch.seat }));
  return { top: reseat(sides.top), right: reseat(sides.right), bottom: reseat(sides.bottom), left: reseat(sides.left), leftUp: sides.leftUp };
}

// The root at the heart of its children, dealt round it the way that takes least room and fits the budget; past it,
// the tree turns down, one node a row.
export function renderMindmap(
  diagram: Mindmap,
  cs: CharSet = UNICODE,
  rounded = true,
  budget?: number,
  autoRotate = true,
  raised = false,
  cramped = false,
  tidy = false
): Canvas {
  const root = diagram.root;
  if (root === undefined) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);

  const top: Branch = { node: root, seat: undefined };
  const bounded = budget !== undefined && autoRotate;
  const fits = (canvas: Canvas): boolean => !bounded || inkedStyled(canvas) <= budget;
  // The shape is chosen tight, then given all the air the budget leaves it.
  const tight = makeChars(cs, rounded, diagram.wrap, 0, raised);
  const children = branchesOf(top);
  const scored = (sides: Sides): { canvas: Canvas; score: number } | undefined => {
    const { canvas, heart, stems } = crossed(top, sides, tight);
    if (!fits(canvas)) return undefined;
    const width = inkedStyled(canvas);
    // What stands out past each edge of the root, weighed against the opposite side's, a drawing and its mirror alike.
    const off = Math.abs(heart.left - (width - 1 - heart.right)) + CELL_ASPECT * Math.abs(heart.top - (canvas.height - 1 - heart.bottom));
    const used = [sides.top, sides.right, sides.bottom, sides.left].filter((side) => side.length > 0).length;
    // Short of rows, the lowest drawing wins, the narrowest among equals.
    const score = cramped ? canvas.height * (budget ?? width) + width : ROOMY * canvas.height + width + CENTRE * off - SIDE_BONUS * used + STEM_COST * Math.max(0, stems);
    return { canvas, score };
  };
  let best: { sides: Sides; canvas: Canvas; score: number; at: number } | undefined;
  const tidied = tidy ? tidySides(children) : undefined;
  if (tidied !== undefined && fits(crossed(top, tidied, tight).canvas)) {
    const weighed = scored(tidied);
    if (weighed !== undefined) best = { sides: tidied, ...weighed, at: 0 };
  } else {
    const floor = floorOf(top, children, tight);
    // A tidy tree too wide for the budget keeps to the root's row, never fanning above or below it.
    const deals = dealsOf(children.length).filter((deal) => !tidy || (deal.top === 0 && deal.bottom === 0));
    // The deals tried from the one whose floor costs least, those whose floor is already too wide left out: past the
    // best found, no deal left can beat it.
    const ranked = deals
      .map((deal, at) => {
        const { rows, width } = floor(deal);
        const used = [deal.top, deal.right, deal.bottom, deal.left].filter((count) => count > 0).length;
        return { deal, at, width, least: cramped ? rows * (budget ?? width) + width : ROOMY * rows + width - SIDE_BONUS * used };
      })
      .filter((one) => !bounded || one.width <= budget)
      .sort((a, b) => a.least - b.least || a.at - b.at);
    for (const { deal, at, least } of ranked) {
      if (best !== undefined && least > best.score) break;
      const sides = dealt(children, deal);
      const weighed = scored(sides);
      if (weighed !== undefined && (best === undefined || weighed.score < best.score || (weighed.score === best.score && at < best.at))) best = { sides, ...weighed, at };
    }
  }
  if (best !== undefined) {
    const sides = seated(best.sides, children);
    const spreads = bounded ? [...SPREADS, 0] : [UNBOUND_SPREAD];
    const aired = firstFitting(spreads, (spread) => crossed(top, sides, makeChars(cs, rounded, diagram.wrap, spread, raised)).canvas, inkedStyled, bounded ? budget : Number.POSITIVE_INFINITY);
    return aired ?? crossed(top, sides, tight).canvas;
  }
  return painted(indentedRows(top, cs, diagram.wrap, budget));
}
