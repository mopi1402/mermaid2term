import { cellId } from "../../canvas/geometry.js";
import { CROSSINGS, DOWN_STROKES } from "../../canvas/alphabet.js";
import { laneId } from "../../graph/routing/pathfinder.js";
import type { Point } from "../../canvas/cells.js";
import { cellsOf, inside, routeLink, type Board, type Route } from "./route.js";
import { HOME, labelFits } from "../../graph/render/label-seats.js";
import { centredAt, centredOnSpan, truncateToWidth } from "../../text/width.js";
import type { Canvas } from "../../canvas/canvas.js";
import type { CharSet } from "../../canvas/model.js";
import type { Block, BlockLink } from "./model.js";
import { SHAPE_RENDERERS } from "../../graph/render/shapes.js";
import { EDGE, EDGE_HEAD, EDGE_LABEL, NODE, SUBGRAPH, SUBGRAPH_LABEL, inkRuns } from "../../canvas/keys.js";
import { NodeShape } from "../../graph/shapes.js";
import { ArrowType, EdgeStyle } from "../../graph/model.js";
import { cornerChar, drawBoxStart, edgeLineChars, headGlyph, walledShape } from "../../graph/render/glyphs.js";
import { type Toward } from "../../canvas/corners.js";
import { BORDERS, sizeOf, type Placed, type Sized } from "./metrics.js";
import { labelLines, widestLabelLine } from "../../text/labels.js";
import { chipTop, putLabelRows } from "../../canvas/chip.js";
import { clusterFrame } from "../../canvas/shape-frame.js";

const TIPS: ReadonlyMap<Toward, readonly [number, number]> = new Map([
  ["right", [1, 0]],
  ["left", [-1, 0]],
  ["up", [0, -1]],
  ["down", [0, 1]],
]);

export function drawBlocks(canvas: Canvas, blocks: Block[], positions: Placed, sizes: Sized, cs: CharSet): void {
  for (const block of blocks) {
    if (block.isSpace) continue;
    const at = positions.get(block.id);
    if (at === undefined) continue;
    if (block.children.length > 0) {
      drawBlocks(canvas, block.children, positions, sizes, cs);
      continue;
    }

    const [w, h] = sizeOf(sizes, block.id);
    const draw = SHAPE_RENDERERS.get(block.shape) ?? SHAPE_RENDERERS.get(NodeShape.RECTANGLE);
    draw?.(canvas, at[0], at[1], w, h, block.label || block.id, cs, NODE);
    // Over the letters the shape just centred, each piece in the weight its tag gives it.
    if (block.labelSegments !== undefined) {
      const col = at[0] + centredAt(w, block.label);
      canvas.putStyledText(at[1] + Math.floor((h - 1) / 2), col, inkRuns(block.labelSegments));
    }
    drawTips(canvas, block, at, w, h, cs);
  }
}

// A block arrow's tip stands in the middle of each wall it points through.
function drawTips(canvas: Canvas, block: Block, [x, y]: [number, number], w: number, h: number, cs: CharSet): void {
  for (const tip of block.arrows) {
    const [dx, dy] = TIPS.get(tip) ?? [0, 0];
    const glyph = headGlyph(cs, ArrowType.ARROW, dx, dy);
    if (glyph === undefined) continue;
    const row = dy === 0 ? y + Math.floor(h / 2) : dy > 0 ? y + h - 1 : y;
    const col = dx === 0 ? x + Math.floor(w / 2) : dx > 0 ? x + w - 1 : x;
    canvas.recast(row, col, glyph);
  }
}

export function drawGroups(canvas: Canvas, blocks: Block[], positions: Placed, sizes: Sized, cs: CharSet): void {
  for (const block of blocks) {
    if (block.children.length === 0) continue;
    const at = positions.get(block.id);
    if (at === undefined) continue;

    const [x, y] = at;
    const [w, h] = sizeOf(sizes, block.id);

    clusterFrame(canvas, x, y, w, h, cs, SUBGRAPH);

    if (block.label !== "") {
      const title = truncateToWidth(block.label, w - BORDERS);
      canvas.putText(y + 1, x + centredAt(w, title), title, SUBGRAPH_LABEL);
    }

    drawGroups(canvas, block.children, positions, sizes, cs);
  }
}

// Every link that can run straight or with its one elbow first, then the others round the blocks and the heads.
// A link between two blocks already linked takes the same line, as mermaid draws both on one centre to centre line.
export function drawLinks(canvas: Canvas, links: readonly BlockLink[], positions: Placed, sizes: Sized, cs: CharSet, board: Board, rounded: boolean): readonly Drawn[] {
  const drawn = new Map<string, Route>();
  const done: Drawn[] = [];
  const between = (from: string, to: string): string => `${from}\n${to}`;
  const place = (link: BlockLink, late: boolean): boolean => {
    const back = drawn.get(between(link.target, link.source));
    const route = drawn.get(between(link.source, link.target)) ?? (back === undefined ? undefined : reversed(back)) ??
      routeLink(board, canvas, link, positions, sizes, late);
    if (route === undefined) return false;
    drawLink(canvas, link, route, cs, board, rounded);
    drawn.set(between(link.source, link.target), route);
    done.push({ link, route });
    return true;
  };
  const late = links.filter((link) => !place(link, false));
  for (const link of late) place(link, true);
  return done;
}

export interface Drawn {
  readonly link: BlockLink;
  readonly route: Route;
}

// Once the blocks stand, each end without a head cuts a tee into the wall it leaves, as a flowchart edge does.
export function drawLinkTees(canvas: Canvas, links: readonly Drawn[], blocks: readonly Block[], cs: CharSet): void {
  const shapes = new Map<string, NodeShape>();
  const walk = (level: readonly Block[]): void => {
    for (const block of level) {
      shapes.set(block.id, block.shape);
      walk(block.children);
    }
  };
  walk(blocks);
  for (const { link, route } of links) {
    if (link.style === EdgeStyle.INVISIBLE) continue;
    const cells = cellsOf(route.corners);
    const ends = [
      [link.source, cells[0], route.startHead, link.hasArrowStart],
      [link.target, cells[cells.length - 1], route.endHead, link.hasArrowEnd],
    ] as const;
    for (const [id, [col, row], [dx, dy], head] of ends) {
      if (!walledShape(shapes.get(id), dx === 0)) continue;
      drawBoxStart(canvas, [col + dx, row + dy], [col, row], cs, head, false, link.style === EdgeStyle.THICK);
    }
  }
}

const reversed = (route: Route): Route => ({ ...route, corners: [...route.corners].reverse(), startHead: route.endHead, endHead: route.startHead });

function drawLink(canvas: Canvas, link: BlockLink, route: Route, cs: CharSet, board: Board, rounded: boolean): void {
  const cells = cellsOf(route.corners);
  const first = cells[0];
  const last = cells[cells.length - 1];
  // A detour meets each wall square, a direct way runs on straight to it.
  const inner: Point | undefined = route.direct ? undefined : [first[0] + route.startHead[0], first[1] + route.startHead[1]];
  const beyond: Point | undefined = route.direct ? undefined : [last[0] + route.endHead[0], last[1] + route.endHead[1]];
  const [hChar, vChar] = edgeLineChars(link.style, cs);
  cells.forEach((cell, i) => {
    const prev = cells[i - 1] ?? inner;
    const next = cells[i + 1] ?? beyond;
    const corner = prev === undefined || next === undefined ? undefined : cornerChar(prev, cell, next, cs, rounded, link.style);
    const along = prev ?? next;
    const across = along === undefined ? route.endHead[1] === 0 : along[1] === cell[1];
    putStroke(canvas, cell, corner ?? (across ? hChar : vChar), corner === undefined, across ? vChar : hChar, board);
    board.lines.add(cellId(cell[0], cell[1]));
    board.lanes.add(laneId(cell[0], cell[1], corner !== undefined || across));
    if (corner !== undefined) board.lanes.add(laneId(cell[0], cell[1], false));
  });

  if (link.hasArrowEnd) putHead(canvas, last, link.typeEnd, route.endHead, cs, board);
  if (link.hasArrowStart) putHead(canvas, first, link.typeStart, route.startHead, cs, board);
  if (link.label !== "") putLinkLabel(canvas, route, link.label, board);
}

// A stroke never covers a head; over a crossing line it is cut, the line down keeping the cell; over a frame's wall, the link runs on.
function putStroke(canvas: Canvas, [col, row]: Point, ch: string, merge: boolean, other: string, board: Board): void {
  if (board.heads.has(cellId(col, row))) return;
  const onFrame = board.frames.has(cellId(col, row)) && canvas.getStyle(row, col) === SUBGRAPH;
  const held = canvas.get(row, col);
  canvas.put(row, col, ch, merge, EDGE);
  if (!CROSSINGS.has(canvas.get(row, col))) return;
  canvas.recast(row, col, onFrame || DOWN_STROKES.has(ch) ? ch : DOWN_STROKES.has(held) ? held : other);
}

function putHead(canvas: Canvas, [col, row]: Point, type: ArrowType, [dx, dy]: Point, cs: CharSet, board: Board): void {
  const glyph = headGlyph(cs, type, dx, dy);
  if (glyph === undefined) return;
  canvas.put(row, col, glyph, false, EDGE_HEAD);
  board.heads.add(cellId(col, row));
}

// Above a run across, beside a run down, every row of it; a link routed round the blocks holds it on its longest run.
function putLinkLabel(canvas: Canvas, route: Route, label: string, board: Board): void {
  const [c1, r1] = route.corners[0];
  const [c2, r2] = route.corners[route.corners.length - 1];
  const rows = labelLines(label);
  const centred = (a: number, b: number): number => centredOnSpan(Math.floor((a + b) / 2), widestLabelLine(label));
  if (route.direct) {
    if (route.endHead[0] === 0) {
      const straight = c1 === c2 ? Math.floor((r1 + r2) / 2) : r2 + (r2 > r1 ? -1 : 1);
      const top = Math.max(Math.min(r1, r2), Math.min(chipTop(straight, label), Math.max(r1, r2) - rows + 1));
      seatLinkLabel(canvas, top, c1 + 1, label);
      return;
    }
    const above = Math.min(r1, r2) - rows;
    seatLinkLabel(canvas, above >= 0 ? above : Math.max(r1, r2) + 1, centred(c1, c2), label);
    return;
  }
  const runs = route.corners.slice(1).map((to, i): readonly [Point, Point] => [route.corners[i], to]);
  const [[a0, a1], [b0, b1]] = runs.reduce((long, run) => (span(run) > span(long) ? run : long));
  if (a1 === b1) {
    seatLinkLabel(canvas, a1 - rows >= 0 ? a1 - rows : a1 + 1, centred(a0, b0), label);
    return;
  }
  // Beside the run, on the row nearest its middle where no block and no other label stands, right of the line first.
  const middle = chipTop(Math.floor((a1 + b1) / 2), label);
  const width = widestLabelLine(label);
  const tops = Array.from({ length: Math.max(1, Math.abs(b1 - a1) - rows + 2) }, (_, i) => Math.min(a1, b1) + i);
  const walled = (row: number, col: number): boolean => canvas.isText(row, col) || board.leaves.some((leaf) => inside(leaf, col, row));
  const seat = tops
    .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))
    .flatMap((top): Point[] => [[a0 + 1, top], [a0 - width, top]])
    .find(([col, top]) => labelFits(canvas, top, col, label, HOME, walled));
  const [col, top] = seat ?? [a0 + 1, middle];
  seatLinkLabel(canvas, top, col, label);
}

// The canvas widens to hold a label that would run off its right edge.
function seatLinkLabel(canvas: Canvas, top: number, col: number, label: string): void {
  canvas.resize(col + widestLabelLine(label), top + labelLines(label));
  putLabelRows(canvas, top, col, label, EDGE_LABEL);
}

const span = ([a, b]: readonly [Point, Point]): number => Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
