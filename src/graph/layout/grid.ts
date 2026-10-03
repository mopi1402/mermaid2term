import { type Node, type Subgraph } from "../model.js";
import { cellId } from "../../canvas/geometry.js";
import { edgesOf, type Edges } from "../../canvas/extent.js";
import { PROP_STROKE_DASHARRAY } from "../../source/css.js";
import { TightAxis, type DrumSeat, type NodePlacement, type GridCoord } from "./laid.js";
import { labelRowsOf } from "../../text/labels.js";
import { MAX_LABEL_WIDTH } from "../../text/wrap.js";

// Four, so a node's coordinate can be halved twice and stay whole: `HALF_STRIDE` is the finest a seat rounds to.
export const STRIDE = 4;

export const HALF_STRIDE = STRIDE / 2;

export const FLANK_LANE = 1;

export const MAX_NORMALIZED_WIDTH = 25;
export const MAX_NORMALIZED_HEIGHT = 7;

export const SG_BORDER_PAD = 2;
const SG_TOP_PAD = 1;
const SG_LABEL_ROW = 1;
export interface FrameRoom {
  side: number;
  lid: number;
  floor: number;
  labelRow: number;
  titleRows: number;
  approach: number;
  standoff: number;
  tight: boolean;
}

export function frameRoom(sg: Subgraph, layout: Pick<GridLayout, "padless" | "upward" | "snugFrames" | "crossedLabels" | "tightAxes" | "titleOf">): FrameRoom {
  // A dashed frame has no eighth to move to, as a dashed box has none: it keeps the box alphabet.
  const tight = layout.padless && !sg.concurrent && sg.props?.has(PROP_STROKE_DASHARRAY) !== true;
  const side = tight && !layout.snugFrames ? SG_BORDER_PAD + 1 : SG_BORDER_PAD;
  // The name stands on the first row the frame holds, serrated or not: a padless lid inks one edge of its own row
  // and leaves the rest of it as air, so the name needs no row bought for it.
  const labelRow = SG_LABEL_ROW;
  // The label is written over the run that crosses its row, so a lid whose label is crossed opens one row wider:
  // the run shows again under the name and its head stands on the box instead of on the text.
  const underLabel = layout.crossedLabels.has(sg.id) ? 1 : 0;
  // A composite's name is ruled off from its body, and the rule keeps a blank row under it, as the floor keeps one
  // over itself: what the frame holds never stands against either line.
  const air = sg.composite && !sg.concurrent ? 1 : 0;
  const titleRows = sg.label === "" ? 0 : labelRowsOf(layout.titleOf(sg)).length;
  const lid = sg.label === "" ? SG_TOP_PAD + 1 : SG_TOP_PAD + labelRow + titleRows + underLabel + air;
  // What a link needs on each side of the frame. A head sits ON a tight rule only where the rule is inked on the
  // OUTER edge of its row, which is the form HORIZONTAL gives it; VERTICAL inks it on the inner edge, a head there
  // reading as a mark dropped within the frame. So it stands off, on TWO rows: a padless frame has no wall to cut a
  // tee into, and the shaft the head is fed by needs a row of its own, the way it does leaving a padless box.
  const approach = tight ? (layout.tightAxes.get(sg.id) === TightAxis.VERTICAL ? 2 : 0) : 1;
  const standoff = tight ? 0 : 1;
  if (layout.upward) return { side, lid: SG_BORDER_PAD, floor: lid, labelRow, titleRows, approach, standoff, tight };
  return { side, lid, floor: SG_BORDER_PAD, labelRow, titleRows, approach, standoff, tight };
}
export const UNSIZED = 1;

export const MIN_APPROACH = 3;

export const MAX_SPREAD_STEP = 2;

export function makePlacement(nodeId: string, grid: GridCoord): NodePlacement {
  return { nodeId, grid, drawX: 0, drawY: 0, drawWidth: 0, drawHeight: 0, bar: false, mark: false, own: false, overhangs: false };
}

// The column and row a placement's centre stands on, rounded toward its left and top.
export const midCol = (p: Pick<NodePlacement, "drawX" | "drawWidth">): number => p.drawX + Math.floor(p.drawWidth / 2);

export const midRow = (p: Pick<NodePlacement, "drawY" | "drawHeight">): number => p.drawY + Math.floor(p.drawHeight / 2);

export const edgesOfPlaced = (p: NodePlacement): Edges => edgesOf({ x: p.drawX, y: p.drawY, w: p.drawWidth, h: p.drawHeight });

export interface SubgraphBounds {
  subgraph: Subgraph;
  x: number;
  y: number;
  width: number;
  height: number;
}

// The seats of links joining the same two boxes: the step to each next seat, the cells their labels take before the
// first and after the last, and all the cells across the box they ask.
export interface Pitch {
  steps: number[];
  before: number;
  after: number;
  cells: number;
}

export class GridLayout {
  placements = new Map<string, NodePlacement>();
  colWidths = new Map<number, number>();
  labelRoom = new Map<number, { low: number; high: number }>();
  rowHeights = new Map<number, number>();
  gridOccupied = new Map<string, string>();
  tightAxes = new Map<string, TightAxis>();
  drums = new Map<string, DrumSeat>();
  padless = false;
  upward = false;
  snugFrames = false;
  gapHeads = new Map<number, GapHeads>();
  // The rows a labelled run between ranks asks of its gap, and how many of them its label's extra rows take.
  gapLabelRows = new Map<number, { rows: number; tall: number }>();
  // The cells a labelled run through a frame's wall asks of its gap, its head included.
  gapLabelCols = new Map<number, number>();
  crossedLabels = new Set<string>();
  // The seats a pair of boxes joined by several labelled links hands them, keyed by the pair.
  parallels = new Map<string, Pitch>();
  // Each named frame whose lid a run passes through, with the boxes those runs reach or leave inside it.
  labelStems = new Map<string, readonly string[]>();
  canvasWidth = 0;
  canvasHeight = 0;
  subgraphBounds: SubgraphBounds[] = [];
  offsetX = 0;
  offsetY = 0;
  // The text each node is drawn with, wrapped and folded here so the parsed graph is never written.
  labels = new Map<string, string>();
  // The columns a label wraps at, mermaid's `wrappingWidth` read in cells.
  wrap = MAX_LABEL_WIDTH;
  // The columns a markdown label wraps at: none under mermaid's `markdownAutoWrap: false`.
  markdownWrap = MAX_LABEL_WIDTH;

  // The title each frame is drawn with, folded on words to hold a width budget.
  titles = new Map<string, string>();

  // The frames whose title or stems widen them past their content and open the column after it, by how many cells.
  spills = new Map<string, number>();

  labelOf(node: Node): string {
    return this.labels.get(node.id) ?? node.label;
  }

  titleOf(sg: Subgraph): string {
    return this.titles.get(sg.id) ?? sg.label;
  }

  occupy(col: number, row: number, id: string): void {
    this.gridOccupied.set(cellId(col, row), id);
  }

  isFree(col: number, row: number, exclude?: Set<string>): boolean {
    if (col < 0 || row < 0) return false;
    const owner = this.gridOccupied.get(cellId(col, row));
    if (owner === undefined) return true;
    return exclude !== undefined && exclude.size > 0 && exclude.has(owner);
  }

  gridToDraw(col: number, row: number): [number, number] {
    let x = this.offsetX;
    for (let c = 0; c < col; c++) x += this.colWidths.get(c) ?? UNSIZED;
    let y = this.offsetY;
    for (let r = 0; r < row; r++) y += this.rowHeights.get(r) ?? UNSIZED;
    return [x, y];
  }

  gridToDrawCenter(col: number, row: number): [number, number] {
    const [x, y] = this.gridToDraw(col, row);
    const w = this.colWidths.get(col) ?? UNSIZED;
    const h = this.rowHeights.get(row) ?? UNSIZED;
    return [this.clearOfWalls(x + Math.floor(w / 2), x, x + w - 1), this.clearOfBoxes(y + Math.floor(h / 2), y, y + h - 1, row)];
  }

  // A lane on a column or a row before the grid's first stands that many cells before everything drawn, frames included.
  laneToDraw(col: number, row: number): [number, number] {
    const [x, y] = this.gridToDrawCenter(Math.max(0, col), Math.max(0, row));
    return [
      col >= 0 ? x : Math.min(this.offsetX, ...this.subgraphBounds.map((sb) => sb.x)) + col,
      row >= 0 ? y : Math.min(this.offsetY, ...this.subgraphBounds.map((sb) => sb.y)) + row,
    ];
  }

  // A lane on the column of a frame's side wall would be drawn over it, so it steps off, outward first.
  private clearOfWalls(at: number, low: number, high: number): number {
    const walled = (x: number): SubgraphBounds | undefined => this.subgraphBounds.find((sb) => x === sb.x || x === sb.x + sb.width - 1);
    const side = walled(at);
    if (side === undefined) return at;
    const outward = at === side.x ? -1 : 1;
    return [at + outward, at - outward].find((to) => to >= low && to <= high && walled(to) === undefined) ?? at;
  }

  private writtenRows(): Set<number> {
    if (this.written !== undefined) return this.written;
    const rows = new Set<number>();
    for (const sb of this.subgraphBounds) {
      if (sb.width <= 0 || sb.height <= 0) continue;
      const { lid, floor } = frameRoom(sb.subgraph, this);
      for (let r = sb.y; r < sb.y + lid - SG_TOP_PAD; r++) rows.add(r);
      for (let r = sb.y + sb.height - (floor - SG_TOP_PAD); r < sb.y + sb.height; r++) rows.add(r);
    }
    this.written = rows;
    return rows;
  }

  private blockRows(): Set<number> {
    if (this.blocks !== undefined) return this.blocks;
    const rows = new Set<number>();
    for (const p of this.placements.values()) for (let d = -1; d <= 1; d++) rows.add(p.grid.row + d);
    this.blocks = rows;
    return rows;
  }

  private clearOfBoxes(at: number, low: number, high: number, row: number): number {
    if (low >= high || this.subgraphBounds.length === 0 || this.blockRows().has(row)) return at;
    const written = this.writtenRows();
    if (!written.has(at)) return at;
    // A lane against a box's border leaves a head turning onto it no shaft, so a row off both is taken first.
    const edges = this.borderRows();
    for (const spare of [(to: number) => !edges.has(to), () => true]) {
      for (let step = 1; step <= high - low; step++) {
        for (const to of [at + step, at - step]) if (to >= low && to <= high && !written.has(to) && spare(to)) return to;
      }
    }
    return at;
  }

  private borderRows(): Set<number> {
    if (this.borders !== undefined) return this.borders;
    const rows = new Set<number>();
    for (const p of this.placements.values()) {
      rows.add(p.drawY - 1);
      rows.add(p.drawY + p.drawHeight);
    }
    this.borders = rows;
    return rows;
  }

  private written: Set<number> | undefined = undefined;
  private borders: Set<number> | undefined = undefined;
  private blocks: Set<number> | undefined = undefined;

  frames(): ReadonlyMap<string, SubgraphBounds> {
    if (this.frameMap === undefined || this.framesOf !== this.subgraphBounds || this.frameMap.size !== this.subgraphBounds.length) {
      this.frameMap = new Map(this.subgraphBounds.map((sb) => [sb.subgraph.id, sb] as const));
      this.framesOf = this.subgraphBounds;
    }
    return this.frameMap;
  }

  frameOf(id: string): SubgraphBounds | undefined {
    return this.frames().get(id);
  }

  private frameMap: Map<string, SubgraphBounds> | undefined = undefined;
  private framesOf: SubgraphBounds[] | undefined = undefined;
}

interface GapHeads {
  low: boolean;
  high: boolean;
  asked: number;
}
