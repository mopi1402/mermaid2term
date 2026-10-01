import { type Canvas } from "./canvas.js";
import { type CharSet } from "./model.js";
import { dashGlyphs, dashLevelOf, NO_BORDER_WIDTH, restyleBox, strokeWidthOf } from "./strokes.js";
import {
  ALT_TAIL, BAND_MARK, BODY_TAIL, CLUSTER_TAIL, DEFAULT_STYLE, FADE_JOIN, FADE_MARK, FADE_WORDS, FONT_JOIN, FONT_MARK, FRAME_FILLS, INK_MARK, NODE, NODE_FAINT, SUBGRAPH_LABEL, WALL_TAIL, inkApart,
} from "./keys.js";
import { colourToHex } from "../colour/colours.js";
import { fillOf, fontWordsOf, hides, opacitiesOf, PROP_COLOR, PROP_STROKE } from "../source/css.js";
import { SPACE } from "../text/chars.js";
import { displayWidth } from "../text/width.js";
import { ACROSS_STROKES, CROSSINGS, DOWN_STROKES, armsOf } from "./alphabet.js";
import { NONE } from "./arms.js";
import { clearRect, onAnEdge, rectFree } from "./cells.js";

export interface FrameBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const EVERY_CELL = (): boolean => true;

// The hex of the fill a box's CSS asks for, `undefined` where it names none.
export const fillHex = (props: ReadonlyMap<string, string> | undefined): string | undefined =>
  props === undefined ? undefined : colourToHex(fillOf(props) ?? "");

// A styled box, a block, a class or an entity: its walls redrawn and faded as its CSS says, its ring inked in its
// stroke, and what lies inside it dressed, the words `worded` owns in its colour and font.
export function styleBox(
  canvas: Canvas,
  box: FrameBox,
  props: ReadonlyMap<string, string>,
  classed: ReadonlyMap<string, string> | undefined,
  cs: CharSet,
  worded: (key: string) => boolean
): void {
  restyleBox(canvas, box.y, box.x, box.h, box.w, props, cs);
  fadeBox(canvas, box, props, classed);
  inkBox(canvas, box, props, cs, worded);
}

// The inks alone, for a box whose walls move between their weight and their ink, as a padless one's do.
// A relation's head standing on the wall's own cell, as padless seats it, keeps the relation's ink.
export function inkBox(canvas: Canvas, box: FrameBox, props: ReadonlyMap<string, string>, cs: CharSet, worded: (key: string) => boolean): void {
  inkRing(canvas, box, colourToHex(props.get(PROP_STROKE) ?? ""), (key) => !onAnEdge(key));
  styleBoxInside(canvas, box, props, cs, worded);
}

const [LEFT_ARM, RIGHT_ARM, UP_ARM, DOWN_ARM] = [0, 1, 2, 3];
const faces = (ch: string, arm: number): boolean => (armsOf(ch)?.[arm] ?? NONE) !== NONE;

// A stroke crossing a wall keeps its cell and the wall is cut: a crossing on the ring whose two sides go on beyond the
// wall, one of them reaching into it, is recast as the stroke that runs through.
export function pierceRing(canvas: Canvas, box: FrameBox, cs: CharSet): void {
  if (box.w <= 2 || box.h <= 2) return;
  const right = box.x + box.w - 1;
  const bottom = box.y + box.h - 1;
  const goesOn = (ch: string, wall: ReadonlySet<string>): boolean => ch !== SPACE && !wall.has(ch);
  const through = (before: string, after: string, arms: readonly [number, number], wall: ReadonlySet<string>, runs: ReadonlySet<string>, plain: string): string | undefined => {
    if (!goesOn(before, wall) || !goesOn(after, wall) || !(faces(before, arms[1]) || faces(after, arms[0]))) return undefined;
    return runs.has(before) ? before : runs.has(after) ? after : plain;
  };
  for (let r = box.y + 1; r < bottom; r++) {
    for (const c of [box.x, right]) {
      if (!CROSSINGS.has(canvas.get(r, c))) continue;
      const run = through(canvas.get(r, c - 1), canvas.get(r, c + 1), [LEFT_ARM, RIGHT_ARM], DOWN_STROKES, ACROSS_STROKES, cs.horizontal);
      if (run !== undefined) canvas.recast(r, c, run);
    }
  }
  for (let c = box.x + 1; c < right; c++) {
    for (const r of [box.y, bottom]) {
      if (!CROSSINGS.has(canvas.get(r, c))) continue;
      const run = through(canvas.get(r - 1, c), canvas.get(r + 1, c), [UP_ARM, DOWN_ARM], ACROSS_STROKES, DOWN_STROKES, cs.vertical);
      if (run !== undefined) canvas.recast(r, c, run);
    }
  }
}

// The four walls of a rectangle, taking the ink a `stroke:` names. `owns` keeps it off a cell something else stands
// on, an edge crossing the wall in its own ink.
export function inkRing(canvas: Canvas, box: FrameBox, stroke: string | undefined, owns: (key: string) => boolean = EVERY_CELL): void {
  if (stroke === undefined) return;
  const right = box.x + box.w - 1;
  const bottom = box.y + box.h - 1;
  const ink = (r: number, c: number): void => {
    const key = canvas.getStyle(r, c);
    if (owns(key)) canvas.setStyle(r, c, key + INK_MARK + stroke);
  };
  for (let c = box.x; c <= right; c++) {
    ink(box.y, c);
    ink(bottom, c);
  }
  for (let r = box.y + 1; r < bottom; r++) {
    ink(r, box.x);
    ink(r, right);
  }
}

// A mark laid on a key under its ink and its band, which the painter reads off the end.
const markedUnder = (key: string, mark: string): string => {
  const at = [key.indexOf(INK_MARK), key.indexOf(BAND_MARK)].filter((found) => found !== -1).reduce((a, b) => Math.min(a, b), key.length);
  return key.slice(0, at) + mark + key.slice(at);
};

// A box's `opacity`, `fill-opacity` and `stroke-opacity`, on every cell it covers: laid FIRST, before the inks and
// the fill, which go on over it. `classed` is what its classes alone say, the only CSS that reaches its words.
export function fadeBox(canvas: Canvas, box: FrameBox, props: ReadonlyMap<string, string>, classed: ReadonlyMap<string, string> | undefined): void {
  const faded = opacitiesOf(props, classed);
  if (faded === undefined) return;
  const hidden = hides(props);
  const unworded = classed !== undefined && hides(classed);
  for (let r = box.y; r < box.y + box.h; r++) {
    for (let c = box.x; c < box.x + box.w; c++) {
      const text = canvas.isText(r, c);
      // Read before a hidden wall is blanked: it is still the outline, faded as one.
      const ink = text || canvas.get(r, c) === SPACE ? faded.words : faded.lines;
      if (text ? unworded : hidden) canvas.recast(r, c, SPACE);
      const fade = FADE_MARK + ink + FADE_JOIN + faded.ground + (text ? FADE_JOIN + FADE_WORDS : "");
      canvas.setStyle(r, c, markedUnder(canvas.getStyle(r, c), fade));
    }
  }
}

// What a box's CSS lays inside its walls, a class box and an ER entity alike: its rules dashed or gone as its stroke
// says and inked in it, its words in the text's `color` and font.
function styleBoxInside(canvas: Canvas, box: FrameBox, props: ReadonlyMap<string, string>, cs: CharSet, worded: (key: string) => boolean): void {
  const stroke = colourToHex(props.get(PROP_STROKE) ?? "");
  const color = colourToHex(props.get(PROP_COLOR) ?? "");
  const font = fontWordsOf(props);
  const fontMark = font.length === 0 ? "" : FONT_MARK + font.join(FONT_JOIN);
  const dashes = dashGlyphs(dashLevelOf(props), false);
  const gone = strokeWidthOf(props) === NO_BORDER_WIDTH;
  const right = box.x + box.w - 1;
  const bottom = box.y + box.h - 1;
  for (let r = box.y + 1; r < bottom; r++) {
    for (let c = box.x + 1; c < right; c++) {
      const key = canvas.getStyle(r, c);
      const ch = canvas.get(r, c);
      const words = ch !== SPACE && worded(key);
      const ruled = ch !== SPACE && (key.startsWith(NODE) || key.startsWith(NODE_FAINT));
      if (ruled && gone && ch === cs.horizontal) {
        canvas.recast(r, c, SPACE);
        continue;
      }
      if (ruled && dashes !== undefined && ch === cs.horizontal) canvas.recast(r, c, dashes.across(c - box.x));
      const ink = words ? color : ruled ? stroke : undefined;
      const marked = words ? key + fontMark : key;
      if (ink !== undefined || marked !== key) canvas.setStyle(r, c, ink === undefined ? marked : marked + INK_MARK + ink);
    }
  }
}

// A cluster wears what mermaid hangs on its rect, a flowchart subgraph and an ER group alike. Its dashes and its
// weight come first, while its corners are still the box's own: a padless frame moves its walls after, and a dashed
// one keeps them where they are.
export function reshapeFrame(canvas: Canvas, box: FrameBox, props: ReadonlyMap<string, string>, cs: CharSet): void {
  restyleBox(canvas, box.y, box.x, box.h, box.w, props, cs);
}

// Its inks come once the cluster's ground is laid, so an inked title still stands on it: the ring's `stroke`, and the
// title's `color` on the row the title stands on.
export function inkFrame(
  canvas: Canvas,
  box: FrameBox,
  props: ReadonlyMap<string, string>,
  titleRow: number,
  owns: (key: string) => boolean = EVERY_CELL
): void {
  inkRing(canvas, box, colourToHex(props.get(PROP_STROKE) ?? ""), owns);
  const color = colourToHex(props.get(PROP_COLOR) ?? "");
  if (color === undefined) return;
  for (let c = box.x + 1; c < box.x + box.w - 1; c++) {
    if (canvas.get(titleRow, c) !== SPACE) canvas.setStyle(titleRow, c, canvas.getStyle(titleRow, c) + INK_MARK + color);
  }
}

const FRAME_GROUNDS = [CLUSTER_TAIL, BODY_TAIL, ALT_TAIL];

// A cell standing on a frame's ground, with that ground taken off: the bare fill, or a key laid on a cluster's or a
// composite body's ground, before or after its ink. Anything else stands on a ground of its own, a box, a band or a
// composite's name, and a frame's fill never reaches it.
function offTheCluster(key: string): string | undefined {
  if (FRAME_FILLS.has(key)) return DEFAULT_STYLE;
  const [base, ink] = inkApart(key);
  const tail = FRAME_GROUNDS.find((ground) => base.endsWith(ground));
  return tail === undefined ? undefined : base.slice(0, -tail.length) + ink;
}

export interface FilledFrame {
  readonly box: FrameBox;
  readonly fill: ReadonlyMap<string, string> | undefined;
  // How far the cluster's ground stands off each pair of borders, as `fillCluster` lays it: a padless border inked on
  // the outer edge of its cell holds the ground in the rest of it.
  readonly walls?: number;
  readonly rules?: number;
}

// A `fill` is the ground of the air inside the frame, laid over the cluster's own. The outermost frame goes first, and
// each frame inside lays its own ground over what it holds, or gives the theme's back where it names none: in mermaid
// every cluster rect is opaque, an inner one hiding the outer's fill.
export function fillFrames(canvas: Canvas, frames: readonly FilledFrame[]): void {
  const grounds = frames.map(({ box, fill, walls = 1, rules = 1 }) => ({ box, walls, rules, fill: fillHex(fill) }));
  if (grounds.every(({ fill }) => fill === undefined)) return;
  const bare = new Map<number, string>();
  const outermostFirst = [...grounds].sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
  for (const { box, fill, walls, rules } of outermostFirst) {
    // A padless border inks one edge of its cell, the rest of it lying inside the frame: that part is the frame's air.
    if (fill !== undefined) {
      for (let r = Math.max(0, box.y); r < box.y + box.h; r++) {
        for (let c = Math.max(0, box.x); c < box.x + box.w; c++) {
          const border = r === box.y || r === box.y + box.h - 1 || c === box.x || c === box.x + box.w - 1;
          if (!border) continue;
          const [base, ink] = inkApart(canvas.getStyle(r, c));
          if (base.endsWith(WALL_TAIL)) canvas.setStyle(r, c, base.slice(0, -WALL_TAIL.length) + ink + BAND_MARK + fill);
        }
      }
    }
    for (let r = Math.max(0, box.y + rules); r < box.y + box.h - rules; r++) {
      for (let c = Math.max(0, box.x + walls); c < box.x + box.w - walls; c++) {
        const at = r * canvas.width + c;
        const key = bare.get(at) ?? canvas.getStyle(r, c);
        const off = offTheCluster(key);
        if (off === undefined) continue;
        bare.set(at, key);
        canvas.setStyle(r, c, fill === undefined ? key : off + BAND_MARK + fill);
      }
    }
  }
}

// Where a frame's title goes on its rows: the column nearest the one the kind puts it at whose cells are blank on every
// row, a blank kept on each side when the rows have room for it. `lo` and `hi` bound the frame's inside, `hi` past it.
function titleColumn(canvas: Canvas, rows: readonly number[], want: number, width: number, lo: number, hi: number): number {
  const blank = (from: number, to: number): boolean => rows.every((row) => rectFree(canvas, row, from, 1, to - from));
  for (const air of [1, 0]) {
    for (let off = 0; off <= hi - lo; off++) {
      for (const c of off === 0 ? [want] : [want + off, want - off]) {
        if (c >= lo && c + width <= hi && blank(c - air, c + width + air)) return c;
      }
    }
  }
  return want;
}

// A frame's title rows moved as one block to the column `titleColumn` picks, each row keeping its place in the block;
// `clear` blanks the cells under each row first.
export function seatTitle(canvas: Canvas, lines: ReadonlyArray<readonly [number, number, string]>, lo: number, hi: number, clear: boolean): void {
  const left = Math.min(...lines.map(([, col]) => col));
  const width = Math.max(...lines.map(([, col, line]) => col - left + displayWidth(line)));
  const shift = titleColumn(canvas, lines.map(([row]) => row), left, width, lo, hi) - left;
  for (const [row, col, line] of lines) {
    if (clear) clearRect(canvas, row, col + shift, 1, displayWidth(line));
    canvas.putText(row, col + shift, line, SUBGRAPH_LABEL);
  }
}
