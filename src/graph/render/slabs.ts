import { Canvas, DEFAULT_STYLE } from "../../canvas/canvas.js";
import { ACROSS_STROKES as RUN_ACROSS, ARCS, BLOCK, DOWN_STROKES as RUN_DOWN, quadrantInside, stubOf } from "../../canvas/alphabet.js";
import { NodeShape } from "../shapes.js";
import { type CharSet } from "../../canvas/model.js";
import { PROP_STROKE, PROP_STROKE_DASHARRAY, PROP_STROKE_WIDTH } from "../../source/css.js";
import { BLANK_CELL, edgeKeyOutside, edgeLeavesThrough, edgeStrokeOutside } from "../../canvas/cells.js";
import { ringCells, type Cell, type Edges } from "../../canvas/extent.js";
const FLAG_NOTCH_SLABS: ReadonlyMap<string, string> = new Map([
  ["\\", "\u25e5"],
  ["/", "\u25e2"],
]);

export function slabFlag(canvas: Canvas, cs: CharSet, top: number, bottom: number, left: number, right: number, slab: string, notchKey: string): void {
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      const ch = canvas.get(r, c);
      if (ch === BLANK_CELL || canvas.isText(r, c)) continue;
      if (ch === cs.flagTip) {
        canvas.recast(r, c, cs.flagTipSlab);
        canvas.setStyle(r, c, notchKey);
        continue;
      }
      const notch = FLAG_NOTCH_SLABS.get(ch);
      if (notch !== undefined) {
        canvas.recast(r, c, notch);
        canvas.setStyle(r, c, slab);
        continue;
      }
      if (r !== top && r !== bottom && c !== right) continue;
      const tee = stubOf(ch);
      if (tee !== undefined) {
        const [stub, stroke] = tee;
        const outward = (c === right && stub === "right") || (r === top && stub === "up") || (r === bottom && stub === "down");
        if (outward) {
          canvas.recast(r, c, edgeStrokeOutside(canvas, r, c, top, bottom, left, right, stroke));
          canvas.setStyle(r, c, edgeKeyOutside(canvas, r, c, top, bottom, left, right));
          continue;
        }
      }
      canvas.recast(r, c, BLANK_CELL);
      canvas.setStyle(r, c, DEFAULT_STYLE);
    }
  }
}

const CARD_CORNER_SLAB = "\u25e2";

export function slabCard(canvas: Canvas, top: number, bottom: number, left: number, right: number, slab: string, fill: string): void {
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (canvas.isText(r, c)) continue;
      const frame = r === top || r === bottom;
      if (!frame && c !== left && c !== right && c !== left + 1) continue;
      if (r === top + 1 && c === left) {
        canvas.recast(r, c, CARD_CORNER_SLAB);
        canvas.setStyle(r, c, slab);
        continue;
      }
      if (edgeLeavesThrough(canvas, r, c, top, bottom, left, right)) continue;
      canvas.recast(r, c, BLANK_CELL);
      canvas.setStyle(r, c, frame ? DEFAULT_STYLE : fill);
    }
  }
}

export const SLAB_TOP = BLOCK.lowerHalf;

export const SLAB_BOTTOM = BLOCK.upperHalf;

export const SLAB_LEFT = BLOCK.rightHalf;

export const SLAB_RIGHT = BLOCK.leftHalf;

export interface SlabTurn {
  // The key a cell of the outline takes once a slab, undefined for a cell that is not the outline's.
  readonly slabOf: (r: number, c: number, ch: string) => string | undefined;
  // A cell the kind settles itself before any half block, its arcs and tees: true once settled.
  readonly settle?: (r: number, c: number, ch: string) => boolean;
  // The half a glyph that is neither a corner nor a run takes.
  readonly half?: (r: number, c: number, ch: string) => string | undefined;
  readonly across: (r: number, c: number) => string | undefined;
  readonly down: (r: number, c: number) => string | undefined;
}

// The half a stroke keeps by where it stands on the box: its rules face down and up, its walls right and left.
export const facingInside = ({ top, bottom, left, right }: Edges): Pick<SlabTurn, "across" | "down"> => ({
  across: (r) => (r === top ? SLAB_TOP : r === bottom ? SLAB_BOTTOM : undefined),
  down: (_r, c) => (c === left ? SLAB_LEFT : c === right ? SLAB_RIGHT : undefined),
});

// A borderless outline as a slab of its own ground: each cell keeps the half block facing inside.
export function slabRing(canvas: Canvas, cells: Iterable<Cell>, turn: SlabTurn): void {
  for (const [r, c] of cells) {
    const ch = canvas.get(r, c);
    const slab = turn.slabOf(r, c, ch);
    if (slab === undefined || turn.settle?.(r, c, ch) === true) continue;
    const block =
      quadrantInside(ch) ??
      turn.half?.(r, c, ch) ??
      (RUN_ACROSS.has(ch) ? turn.across(r, c) : undefined) ??
      (RUN_DOWN.has(ch) ? turn.down(r, c) : undefined);
    if (block === undefined) continue;
    canvas.recast(r, c, block);
    canvas.setStyle(r, c, slab);
  }
}

// A box's outline alone as a slab of its ground, whatever it holds left be: each cell `owned` keeps the half facing
// inside, a square corner its quadrant, a rounded one giving its cell back to the ground around, as a node's does.
export function slabOutline(canvas: Canvas, edges: Edges, slab: string, owned: (r: number, c: number) => boolean): void {
  const corner = (r: number, c: number): boolean => (r === edges.top || r === edges.bottom) && (c === edges.left || c === edges.right);
  const facing = facingInside(edges);
  slabRing(canvas, ringCells(edges), {
    slabOf: (r, c) => (canvas.isText(r, c) || !owned(r, c) ? undefined : slab),
    settle: (r, c, ch) => {
      if (!ARCS.has(ch)) return false;
      canvas.recast(r, c, BLANK_CELL);
      canvas.setStyle(r, c, DEFAULT_STYLE);
      return true;
    },
    half: (r, c) => (corner(r, c) ? undefined : (facing.across(r, c) ?? facing.down(r, c))),
    ...facing,
  });
}

export const slabSlope = (cs: CharSet, ch: string): readonly [onLeft: string, onRight: string] | undefined =>
  ch === cs.slopeRise ? ["\u25e2", "\u25e4"] : ch === cs.slopeFall ? ["\u25e5", "\u25e3"] : undefined;

export const SLANTED_SHAPES = new Set([
  NodeShape.PARALLELOGRAM,
  NodeShape.PARALLELOGRAM_ALT,
  NodeShape.TRAPEZOID,
  NodeShape.TRAPEZOID_ALT,
  NodeShape.HEXAGON,
]);

export const asksBorder = (props: ReadonlyMap<string, string> | undefined): boolean =>
  props !== undefined && (props.has(PROP_STROKE) || props.has(PROP_STROKE_DASHARRAY) || props.has(PROP_STROKE_WIDTH));
