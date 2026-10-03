import { type Direction, type Graph, isHorizontal, type Subgraph } from "../model.js";
import { axisOf } from "../axis.js";
import { placedEdges } from "./edges.js";
import { widestLabelLine } from "../../text/labels.js";
import { boxesUnder, chainOf, membersOf } from "../subgraph-tree.js";
import { must } from "../../must.js";
import { BARS, MARKS, NodeShape } from "../shapes.js";
import { frameRoom, midCol, type GridLayout, UNSIZED, type SubgraphBounds } from "./grid.js";
import { drumBorrows } from "./padless.js";
import { DrumRim } from "./laid.js";
import { barThickness } from "./boxes.js";
import { centredOffset } from "../../text/width.js";

// NONE. At one, every drawing holding a subgraph opened on a blank row and column that no other drawing had.
const CLEARANCE = 0;


export function computeDrawCoords(layout: GridLayout): void {
  for (const placement of layout.placements.values()) {
    const { col, row } = placement.grid;
    const [x, y] = layout.gridToDraw(col - 1, row - 1);
    let width = 0;
    let height = 0;
    for (let d = -1; d <= 1; d++) {
      width += layout.colWidths.get(col + d) ?? UNSIZED;
      height += layout.rowHeights.get(row + d) ?? UNSIZED;
    }
    placement.drawX = x;
    placement.drawY = y;
    placement.drawWidth = width;
    placement.drawHeight = height;
  }
}

export function flattenBars(graph: Graph, layout: GridLayout, direction: Direction): void {
  const horizontal = isHorizontal(direction);
  for (const [id, p] of layout.placements) {
    const node = graph.nodes.get(id);
    if (node === undefined) continue;
    if (MARKS.has(node.shape)) {
      p.bar = true;
      p.mark = true;
      continue;
    }
    if (!BARS.has(node.shape)) continue;
    const { col, row } = p.grid;
    p.bar = true;
    const thick = barThickness(node.shape);
    if (horizontal) {
      const track = layout.colWidths.get(col) ?? UNSIZED;
      const across = Math.min(thick, track);
      p.drawX += (layout.colWidths.get(col - 1) ?? UNSIZED) + centredOffset(track, across);
      p.drawWidth = across;
    } else {
      const track = layout.rowHeights.get(row) ?? UNSIZED;
      const across = Math.min(thick, track);
      p.drawY += (layout.rowHeights.get(row - 1) ?? UNSIZED) + centredOffset(track, across);
      p.drawHeight = across;
    }
  }
}

export function adjustForNegativeBounds(layout: GridLayout): void {
  if (layout.subgraphBounds.length === 0) return;

  let minX = 0;
  let minY = 0;
  for (const sb of layout.subgraphBounds) {
    minX = Math.min(minX, sb.x);
    minY = Math.min(minY, sb.y);
  }
  if (minX >= 0 && minY >= 0) return;

  shiftDrawing(layout, minX < 0 ? -minX + CLEARANCE : 0, minY < 0 ? -minY + CLEARANCE : 0);
}

function shiftDrawing(layout: GridLayout, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  for (const p of layout.placements.values()) {
    p.drawX += dx;
    p.drawY += dy;
  }
  for (const sb of layout.subgraphBounds) {
    sb.x += dx;
    sb.y += dy;
  }
  layout.offsetX += dx;
  layout.offsetY += dy;
}

export function reserveDrumRims(graph: Graph, layout: GridLayout): void {
  let dy = 0;
  for (const [id, p] of layout.placements) {
    const node = graph.nodes.get(id);
    if (node === undefined || layout.drums.get(id)?.rim !== DrumRim.ABOVE || !drumBorrows(layout.labelOf(node), p.drawHeight)) continue;
    dy = Math.max(dy, 1 - p.drawY);
  }
  shiftDrawing(layout, 0, dy);
}

// Says whether a mark moved, its frames then measured again: they were taken around the seat it left.
// The rows a frame holds, below its lid and above its floor. A start's frame that fills them with one frame of its own
// holds what that one holds: a composite's name weighs more above it than its floor below, and the marks of a chain of
// nested composites line up on the innermost middle rather than stepping one row per level.
function heldRows(layout: GridLayout, sb: SubgraphBounds, descend: boolean): readonly [number, number] {
  const { lid, floor } = frameRoom(sb.subgraph, layout);
  const start = sb.y + lid;
  const end = sb.y + sb.height - floor;
  const fills = (inner: SubgraphBounds): boolean =>
    inner !== sb && inner.y === start && inner.y + inner.height === end && inner.x > sb.x && inner.x + inner.width < sb.x + sb.width;
  const filling = descend ? layout.subgraphBounds.find(fills) : undefined;
  return filling === undefined ? [start, end] : heldRows(layout, filling, descend);
}

export function centreMarks(graph: Graph, layout: GridLayout, direction: Direction): boolean {
  const horizontal = isHorizontal(direction);
  const axis = axisOf(horizontal);
  let moved = false;

  for (const [id, p] of layout.placements) {
    const shape = graph.nodes.get(id)?.shape;
    if (!p.mark || (shape !== NodeShape.START_STATE && shape !== NodeShape.END_STATE)) continue;
    let alone = true;
    for (const [other, q] of layout.placements) if (other !== id && axis.along(q) === axis.along(p)) alone = false;
    if (!alone) continue;

    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    // Between two boxes or more the mark stands midway between the frames themselves: their content sits under a
    // name taller than their floor, and the middle of two contents falls a row into the lower frame.
    let lowFrame = Number.POSITIVE_INFINITY;
    let highFrame = Number.NEGATIVE_INFINITY;
    let joined = 0;
    let known = true;
    let levelled = false;
    let boxes = 0;
    const lane = axis.across(p);
    for (const edge of graph.edges) {
      const leaving = edge.source === id;
      if (!leaving && edge.target !== id) continue;
      const other = leaving ? edge.target : edge.source;
      const asBox = leaving ? edge.targetIsSubgraph : edge.sourceIsSubgraph;
      const sb = asBox ? layout.frameOf(other) : undefined;
      const q = layout.placements.get(other);
      if (q !== undefined && axis.across(q) === lane) levelled = true;
      let from: number;
      let to: number;
      if (sb !== undefined) {
        // A box counts by the middle of what it holds, where its runs come in: a tall box would drag the mark to its lid.
        // A start feeds the start inside the box, and lines up with it down a chain of nested composites.
        const [start, end] = horizontal ? heldRows(layout, sb, leaving) : [sb.x, sb.x + sb.width];
        from = Math.floor((start + end - 1) / 2);
        to = from + 1;
        const whole = horizontal ? Math.floor((2 * sb.y + sb.height - 1) / 2) : from;
        lowFrame = Math.min(lowFrame, whole);
        highFrame = Math.max(highFrame, whole + 1);
      }
      else if (q !== undefined) [from, to] = horizontal ? [q.drawY, q.drawY + q.drawHeight] : [q.drawX, q.drawX + q.drawWidth];
      else {
        known = false;
        break;
      }
      joined++;
      if (sb !== undefined) boxes++;
      else {
        lowFrame = Math.min(lowFrame, from);
        highFrame = Math.max(highFrame, to);
      }
      low = Math.min(low, from);
      high = Math.max(high, to);
    }
    if (!known || (joined < 2 && boxes === 0) || levelled) continue;

    const centre = boxes >= 2 ? Math.floor((lowFrame + highFrame - 1) / 2) : Math.floor((low + high - 1) / 2);
    const size = horizontal ? p.drawHeight : p.drawWidth;
    const at = centre - Math.floor(size / 2);
    if (at === (horizontal ? p.drawY : p.drawX)) continue;

    const x = horizontal ? p.drawX : at;
    const y = horizontal ? at : p.drawY;
    const meets = (bx: number, by: number, bw: number, bh: number): boolean =>
      x < bx + bw && bx < x + p.drawWidth && y < by + bh && by < y + p.drawHeight;
    let clear = true;
    for (const [other, q] of layout.placements) {
      if (other !== id && meets(q.drawX, q.drawY, q.drawWidth, q.drawHeight)) clear = false;
    }
    const own = chainOf(graph, id);
    const inside = (sb: SubgraphBounds): boolean =>
      sb.x < x && x + p.drawWidth < sb.x + sb.width && sb.y < y && y + p.drawHeight < sb.y + sb.height;
    for (const sb of layout.subgraphBounds) {
      if (own.has(sb.subgraph.id) ? !inside(sb) : meets(sb.x, sb.y, sb.width, sb.height)) clear = false;
    }
    if (!clear) continue;

    if (horizontal) p.drawY = at;
    else p.drawX = at;
    moved = true;
  }
  return moved;
}

// Says, for each frame its title or the stems beside it widen past its content, by how many columns.
export function computeSubgraphBounds(graph: Graph, layout: GridLayout): ReadonlyMap<string, number> {
  const spills = new Map<string, number>();
  const compute = (sg: Subgraph): SubgraphBounds | undefined => {
    const childBounds: SubgraphBounds[] = [];
    for (const child of sg.children) {
      const bounds = compute(child);
      if (bounds === undefined) continue;
      childBounds.push(bounds);
      layout.subgraphBounds.push(bounds);
    }

    const ids = membersOf(sg);
    if (ids.size === 0 && childBounds.length === 0) return undefined;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = 0;
    let maxY = 0;
    for (const id of ids) {
      const p = layout.placements.get(id);
      if (p === undefined) continue;
      minX = Math.min(minX, p.drawX);
      minY = Math.min(minY, p.drawY);
      maxX = Math.max(maxX, p.drawX + p.drawWidth);
      maxY = Math.max(maxY, p.drawY + p.drawHeight);
    }
    for (const cb of childBounds) {
      minX = Math.min(minX, cb.x);
      minY = Math.min(minY, cb.y);
      maxX = Math.max(maxX, cb.x + cb.width);
      maxY = Math.max(maxY, cb.y + cb.height);
    }
    if (minX === Number.POSITIVE_INFINITY) return undefined;

    for (const { edge, src: a, tgt: b } of placedEdges(graph, layout)) {
      if (edge.label === "" || !ids.has(edge.source) || !ids.has(edge.target)) continue;
      if (a.grid.col !== b.grid.col || a.grid.row === b.grid.row) continue;
      const shaft = midCol(a);
      const reach = widestLabelLine(edge.label) + 2;
      minX = Math.min(minX, shaft - reach);
      maxX = Math.max(maxX, shaft + 1 + reach);
    }

    const { side, lid, floor } = frameRoom(sg, layout);
    const contentWidth = maxX - minX + side * 2;
    const labelWidth = widestLabelLine(layout.titleOf(sg)) + side * 2;
    const width = besideStems(layout, sg, minX - side, Math.max(contentWidth, labelWidth), side);
    if (width > contentWidth) spills.set(sg.id, width - contentWidth);
    return { subgraph: sg, x: minX - side, y: minY - lid, width, height: maxY - minY + floor + lid };
  };

  for (const sg of graph.subgraphs) {
    const bounds = compute(sg);
    if (bounds !== undefined) layout.subgraphBounds.push(bounds);
  }
  return spills;
}

// A frame widened past its content opens the column after its last box by as much, whenever a box or another frame
// stands further right across its rows: that neighbour keeps the room it was laid with from the wall. The innermost
// frames go first, a frame holding them measured once they are settled. Says whether a column opened.
export function reserveSpills(layout: GridLayout, spills: ReadonlyMap<string, number>, settled: Set<string>): boolean {
  const unsettled = (sg: Subgraph): boolean => spills.has(sg.id) && !settled.has(sg.id);
  for (;;) {
    const ready = layout.subgraphBounds.filter((sb) => unsettled(sb.subgraph) && !boxesUnder(sb.subgraph).slice(1).some(unsettled));
    if (ready.length === 0) return false;
    // Two frames opening one column in a round, one above the other, ask it once, the wider spill.
    const asks = new Map<number, number>();
    for (const sb of ready) {
      settled.add(sb.subgraph.id);
      const held = membersOf(sb.subgraph);
      const spill = must(spills.get(sb.subgraph.id));
      const content = sb.x + sb.width - spill;
      const across = (y: number, h: number): boolean => y < sb.y + sb.height && sb.y < y + h;
      const boxes = [...layout.placements].filter(([id, p]) => !held.has(id) && p.drawX >= content && across(p.drawY, p.drawHeight));
      const nested = (other: SubgraphBounds): boolean => boxesUnder(sb.subgraph).includes(other.subgraph) || boxesUnder(other.subgraph).includes(sb.subgraph);
      const frames = layout.subgraphBounds.filter((other) => !nested(other) && other.x >= content && across(other.y, other.height));
      if (boxes.length === 0 && frames.length === 0) continue;
      const last = Math.max(...[...held].map((id) => layout.placements.get(id)?.grid.col ?? 0));
      asks.set(last + 2, Math.max(asks.get(last + 2) ?? 0, spill));
      layout.spills.set(sb.subgraph.id, spill);
    }
    for (const [gap, spill] of asks) layout.colWidths.set(gap, (layout.colWidths.get(gap) ?? UNSIZED) + spill);
    if (asks.size > 0) return true;
  }
}

// A frame whose name is crossed by the runs reaching or leaving its boxes is as wide as the name needs to stand clear of every
// stem, a blank on each side: beside the first stem, between two, or past the last one, which widens the frame.
function besideStems(layout: GridLayout, sg: Subgraph, x: number, width: number, side: number): number {
  const reached = layout.labelStems.get(sg.id);
  if (reached === undefined) return width;
  const stems = reached.flatMap((id) => {
    const p = layout.placements.get(id);
    return p === undefined ? [] : [midCol(p)];
  }).sort((a, b) => a - b);
  if (stems.length === 0) return width;
  const name = widestLabelLine(layout.titleOf(sg));
  const walls = [x, ...stems, x + width - 1];
  if (walls.some((at, i) => i > 0 && at - walls[i - 1] - 3 >= name)) return width;
  return Math.max(width, stems[stems.length - 1] + 2 + name + side - x);
}
