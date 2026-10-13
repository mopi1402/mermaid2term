import { type CharSet } from "../../canvas/model.js";
import { displayWidth } from "../../text/width.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { SPACE } from "../../text/chars.js";
import { DEFAULT_STYLE, NODE, inkRuns } from "../../canvas/keys.js";
import { glyphOfArms } from "../../canvas/corners.js";
import { DOWN, LEFT, RIGHT, UP } from "../../canvas/merge.js";
import { chipRows, labelRows, run, rowWidth, type Piece, type Row } from "./label.js";
import { type Branch, branchesOf, edgeKey, nodeKey, trunkKey } from "./sections.js";


export interface Chars {
  h: string;
  v: string;
  tj: string;
  tjL: string;
  // The glyph a cell wears for its arms, `UP | DOWN | LEFT | RIGHT`.
  armed: (arms: number) => string;
  icons: Readonly<Record<string, string>>;
  wrap: number;
  // The extra columns every joint and every gap between siblings takes where the budget has room for them.
  spread: number;
  // Whether the root stands on three rows of its ground: only where a theme paints that ground.
  raised: boolean;
}

export function makeChars(cs: CharSet, rounded: boolean, wrap: number, spread = 0, raised = false): Chars {
  return { h: cs.horizontal, v: cs.vertical, tj: cs.teeLeft, tjL: cs.teeRight, armed: (arms) => glyphOfArms(arms, cs, rounded), icons: cs.icons, wrap, spread, raised };
}

// Rows measured in columns, and the row a parent's line comes in on.
// The run from a node to the spine of its children, longer with the spread.
export const joint = (ch: Chars): string => ch.h.repeat(2 + ch.spread);

export interface Block {
  readonly rows: Row[];
  readonly connect: number;
}

export const widthOf = (block: Block): number => Math.max(0, ...block.rows.map(rowWidth));

const blank = (width: number): Row => (width > 0 ? [run(SPACE.repeat(width))] : []);

const padEnd = (row: Row, width: number): Row => [...row, ...blank(width - rowWidth(row))];

const padStart = (row: Row, width: number): Row => [...blank(width - rowWidth(row)), ...row];

export function painted(rows: readonly Row[]): Canvas {
  const canvas = new Canvas(Math.max(EMPTY_SIZE, ...rows.map(rowWidth)) + 1, rows.length);
  rows.forEach((row, r) => {
    let col = 0;
    for (const piece of inkedPart(row)) {
      const key = piece.key ?? NODE;
      if (piece.bold || piece.italic) canvas.putStyledText(r, col, inkRuns([piece], "", key));
      else canvas.putText(r, col, piece.text, key);
      if (piece.key !== undefined) blanksKeyed(canvas, r, col, displayWidth(piece.text), key);
      col += displayWidth(piece.text);
    }
  });
  return canvas;
}

// A blank inside a node is the node's fill, which `putText` leaves unkeyed.
function blanksKeyed(canvas: Canvas, row: number, col: number, width: number, key: string): void {
  for (let at = col; at < col + width; at++) if (canvas.getStyle(row, at) === DEFAULT_STYLE) canvas.setStyle(row, at, key);
}

// The padding that squares a block off is layout only: the canvas gets what the row shows, a node's own blanks kept.
function inkedPart(row: Row): Row {
  const out = [...row];
  while (out.length > 0 && out[out.length - 1].key === undefined && out[out.length - 1].text.trim() === "") out.pop();
  const last = out[out.length - 1];
  if (last !== undefined && last.key === undefined) out[out.length - 1] = { ...last, text: last.text.trimEnd() };
  return out;
}

// A label broken over several rows is joined on its middle one, as mermaid meets a node at its centre.
// Each row centred on the widest, so the node's ground is one rectangle, as mermaid's box is.
const squared = (rows: readonly Row[]): Row[] => {
  const width = Math.max(0, ...rows.map(rowWidth));
  return rows.map((row) => {
    const room = width - rowWidth(row);
    return [...blank(Math.floor(room / 2)), ...row, ...blank(room - Math.floor(room / 2))];
  });
};

// The root stands out on a row of its own ground above its text and one below.
const raised = (rows: Row[], key: string): Row[] => {
  const ground = [run(SPACE.repeat(Math.max(0, ...rows.map(rowWidth))), key)];
  return [ground, ...rows, ground];
};

export function labelBlock(branch: Branch, ch: Chars): Block {
  const key = nodeKey(branch);
  const chipped = chipRows(squared(labelRows(branch.node, ch.icons, ch.wrap)), key);
  const rows = branch.seat === undefined && ch.raised ? raised(chipped, key) : chipped;
  return { rows, connect: Math.floor((rows.length - 1) / 2) };
}

// Two blocks side by side, their joining rows on one line and the joint between them.
export function beside(left: Block, joint: Piece, right: Block): Block {
  const top = Math.max(left.connect, right.connect);
  const leftAt = top - left.connect;
  const rightAt = top - right.connect;
  const height = Math.max(leftAt + left.rows.length, rightAt + right.rows.length);
  const width = widthOf(left);
  const full = width + displayWidth(joint.text) + widthOf(right);
  const gap = run(SPACE.repeat(displayWidth(joint.text)));
  const rows: Row[] = [];
  for (let r = 0; r < height; r++) {
    const own = left.rows[r - leftAt] ?? [];
    // Every row as wide as the block, so a stack on the left side can right-align it whole.
    rows.push(padEnd([...padEnd(own, width), r === top ? joint : gap, ...(right.rows[r - rightAt] ?? [])], full));
  }
  return { rows, connect: top };
}

function subtreeRight(branch: Branch, ch: Chars): Block {
  const label = labelBlock(branch, ch);
  const children = branchesOf(branch);
  return children.length === 0 ? label : beside(label, run(joint(ch), trunkKey(children)), stackRight(children, ch));
}

function subtreeLeft(branch: Branch, ch: Chars): Block {
  const label = labelBlock(branch, ch);
  const children = branchesOf(branch);
  return children.length === 0 ? label : beside(stackLeft(children, ch), run(joint(ch), trunkKey(children)), label);
}

export interface StemArms {
  readonly before: number;
  readonly after: number;
  readonly child: number;
  readonly parent: number;
}

// The arms of the cell `at` of a spine or bar run from `first` to `last`, with a child's arm where a child leaves it
// and the parent's where the stem does.
export const stemArms = (arms: StemArms, at: number, first: number, last: number, child: boolean, stem: boolean): number =>
  (at > first ? arms.before : 0) | (at < last ? arms.after : 0) | (child ? arms.child : 0) | (stem ? arms.parent : 0);

// The child a cell of a spine or bar leads on to, the nearest on its side of the stem, -1 before the first.
export const nearestChild = (ends: readonly number[], at: number, mid: number): number =>
  at < mid ? ends.reduce((found, end, k) => (end <= at ? k : found), -1) : ends.findIndex((end) => end >= at);

// The spine a stack of children hangs on: one mark per row, a child's arm at each child and the parent's arm half way
// between the first and the last. Each row is inked for the nearest child its line leads to from the parent, the tee
// facing the parent for them all.
function spine(blocks: readonly Block[], children: readonly Branch[], ch: Chars, child: number, parent: number): readonly [string[], number, string[]] {
  const connects: number[] = [];
  let height = 0;
  for (const block of blocks) {
    connects.push(height + block.connect);
    height += block.rows.length;
  }
  const firstConnect = connects[0];
  const lastConnect = connects[connects.length - 1];
  const mid = Math.floor((firstConnect + lastConnect) / 2);
  const arms: StemArms = { before: UP, after: DOWN, child, parent };
  const marks = Array.from({ length: height }, (_mark, row) =>
    row < firstConnect || row > lastConnect ? SPACE : ch.armed(stemArms(arms, row, firstConnect, lastConnect, connects.includes(row), row === mid))
  );
  const owner = (row: number): Branch | undefined =>
    row === mid && !connects.includes(mid) ? undefined : children[nearestChild(connects, row, mid)];
  const keys = marks.map((_mark, row) => {
    const child = owner(row);
    return child === undefined ? trunkKey(children) : edgeKey(child.seat);
  });
  return [marks, mid, keys];
}

// Siblings a row each sit tight; one that spreads over several rows keeps a blank row from its neighbours, and the
// root's own branches, `apart`, always do, so each change of branch reads as one.
const spaced = (blocks: readonly Block[], apart: boolean): Block[] =>
  blocks.map((block, at) => {
    const next = blocks[at + 1];
    return next !== undefined && (apart || block.rows.length > 1 || next.rows.length > 1) ? { ...block, rows: [...block.rows, []] } : block;
  });

// Children stacked on the right of their parent's joint (`right`) or on its left, each hung on the spine by a stub.
function stack(children: Branch[], ch: Chars, apart: boolean, right: boolean): Block {
  const blocks = spaced(children.map((child) => (right ? subtreeRight(child, ch) : subtreeLeft(child, ch))), apart);
  const width = Math.max(...blocks.map(widthOf));
  const lay = (row: Row, link: Piece): Row => (right ? [link, ...row] : [...padStart(row, width), link]);
  const only = blocks[0];
  if (blocks.length === 1 && only !== undefined) {
    const key = trunkKey(children);
    return { rows: only.rows.map((row, i) => lay(row, run(i === only.connect ? joint(ch) : SPACE.repeat(displayWidth(joint(ch))), key))), connect: only.connect };
  }
  const [marks, mid, keys] = spine(blocks, children, ch, right ? RIGHT : LEFT, right ? LEFT : RIGHT);
  const rows = blocks.flatMap((block) => block.rows);
  const faced = right ? ch.tj : ch.tjL;
  const stub = (mark: string): string => (mark === ch.v || mark === SPACE || mark === faced ? SPACE : ch.h);
  return { rows: rows.map((row, i) => lay(row, run(right ? marks[i] + stub(marks[i]) : stub(marks[i]) + marks[i], keys[i]))), connect: mid };
}

export function stackRight(children: Branch[], ch: Chars, apart = false): Block {
  return stack(children, ch, apart, true);
}

export function stackLeft(children: Branch[], ch: Chars, apart = false): Block {
  return stack(children, ch, apart, false);
}
