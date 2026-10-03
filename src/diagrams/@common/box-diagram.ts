import { Direction } from "../../graph/model.js";
import { NUL } from "../../text/chars.js";
import type { Canvas } from "../../canvas/canvas.js";
import { stampChip } from "../../canvas/chip.js";
import { rectFree } from "../../canvas/cells.js";
import { EDGE_CHIP } from "../../canvas/keys.js";
import { must } from "../../must.js";
import type { RelationLabel } from "../../source/markdown.js";
import { wornProps } from "../../source/css.js";

export const DEFAULT_DIRECTION = Direction.TB;

export const SOLID = "solid";

export const DASHED = "dashed";

export type LineStyle = typeof SOLID | typeof DASHED;

const DIRECTION_WORDS = String.raw`direction\s+(TB|LR|BT|RL|TD)`;

export const DIRECTION_RE = new RegExp(String.raw`^\s*${DIRECTION_WORDS}\s*$`, "iu");

// mermaid's rule is `.*direction\s+LR[^\n]*`: the words are read wherever they stand and the whole line goes with
// them, in the case the lexer reads them in (the class lexer alone is case sensitive).
export const DIRECTION_ANYWHERE_RE = new RegExp(DIRECTION_WORDS, "iu");

export const DIRECTION_ANYWHERE_CASED_RE = new RegExp(DIRECTION_WORDS, "u");

export const CLOSING_BRACE = "}";

// The rows of a class or entity block whose `{` ends the row before `from`, blank ones skipped, up to its `}`, and
// the index past that `}` (past the end while the block runs on).
export function braceBody(lines: readonly string[], from: number): { readonly rows: string[]; readonly next: number } {
  const rows: string[] = [];
  let at = from;
  while (at < lines.length) {
    const body = lines[at].trim();
    at += 1;
    if (body === CLOSING_BRACE) break;
    if (body !== "") rows.push(body);
  }
  return { rows, next: at };
}

type ClassDefs = Map<string, Map<string, string>>;

export interface BoxDiagram {
  classDefs: ClassDefs;
  direction: Direction;
  directionDeclared: boolean;
  warnings: string[];
}

// The properties a class or an entity box wears: `classDef default`, then each of its classes, then its own `style`.
export const boxProps = (diagram: BoxDiagram, box: { cssClasses: readonly string[]; styles: ReadonlyMap<string, string> }): ReadonlyMap<string, string> | undefined =>
  wornProps(diagram.classDefs, box.cssClasses, box.styles);

// What its classes alone say, `classDef default` first: the only CSS mermaid lets reach a box's words.
export const boxClassProps = (diagram: BoxDiagram, box: { cssClasses: readonly string[] }): ReadonlyMap<string, string> | undefined =>
  wornProps(diagram.classDefs, box.cssClasses, undefined);

export interface Laid {
  positions: Map<string, [number, number]>;
  sizes: Map<string, [number, number]>;
  width: number;
  height: number;
  layerOf: Map<string, number>;
}

// An unordered pair of box names as one key, NUL-separated so no name can collide.
export const pairKey = (a: string, b: string): string => (a <= b ? `${a}${NUL}${b}` : `${b}${NUL}${a}`);

// The room between two boxes of one layer: the most any relation joining them `needs`, never less than `gap`.
export function sameLayerGaps<R>(
  relations: readonly R[],
  ends: (rel: R) => readonly [string, string],
  layerOf: ReadonlyMap<string, number>,
  gap: number,
  needed: (rel: R) => number
): Map<string, number> {
  const pairGap = new Map<string, number>();
  for (const rel of relations) {
    const [one, two] = ends(rel);
    const layer = layerOf.get(one);
    if (one === two || layer === undefined || layer !== layerOf.get(two)) continue;
    const key = pairKey(one, two);
    pairGap.set(key, Math.max(pairGap.get(key) ?? gap, needed(rel)));
  }
  return pairGap;
}

// Whether `width` cells of `row` from `from` fall on one of the laid boxes.
export function insideABox(laid: Laid, row: number, from: number, width: number): boolean {
  for (const [name, [bx, by]] of laid.positions) {
    const [bw, bh] = must(laid.sizes.get(name));
    if (row >= by && row < by + bh && from < bx + bw && from + width > bx) return true;
  }
  return false;
}

// Every row of a label block clear of boxes and of whatever `blank` refuses, `skipRow` left unread.
export function labelSeatClear(
  laid: Laid,
  canvas: Canvas,
  top: number,
  from: number,
  width: number,
  height: number,
  blank: (row: number, col: number) => boolean,
  skipRow = -1
): boolean {
  if (from < 1 || top < 0) return false;
  for (let row = top; row < top + height; row++) {
    if (row === skipRow) continue;
    if (insideABox(laid, row, from, width) || !rectFree(canvas, row, from, 1, width, blank)) return false;
  }
  return true;
}

// A relation's chip written from its top row, every row of a label broken on `<br>` under the first.
export const writeChip = (canvas: Canvas, top: number, col: number, rel: RelationLabel): void =>
  stampChip(canvas, top, col, rel.label, EDGE_CHIP, rel.labelSegments);
