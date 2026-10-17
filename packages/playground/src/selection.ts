import { useEffect, useRef, type RefObject } from "react";
import { displayWidth } from "@tayomi/mermaid2term";

// A hand-made selection copies the PLAIN drawing cut to its columns, never the grid's HTML (`grid.test.ts`).

export interface Point {
  readonly row: number;
  readonly column: number;
}

const NEWLINE = "\n";
const ROW = ".row";
const CELL = ".cell";
const COLUMNS = "--w";
const BY_COLUMN = "by-column";

const widthOf = (cell: Element): number =>
  (cell instanceof HTMLElement ? Number(cell.style.getPropertyValue(COLUMNS)) : 0) || displayWidth(cell.textContent ?? "");

/** The column a cell opens at, or the columns the whole row spends when the cell is not one of its own. */
const startOf = (row: Element, cell: Element | undefined): number => {
  let column = 0;
  for (const other of row.querySelectorAll(CELL)) {
    if (other === cell) break;
    column += widthOf(other);
  }
  return column;
};

const cellIn = (node: Element): Element | undefined => (node.matches(CELL) ? node : (node.querySelector(CELL) ?? undefined));

// The DOM's own nullish, taken at the door and never carried further.
const closest = (element: Element, selector: string): Element | undefined => element.closest(selector) ?? undefined;

/** Where an edge of the selection sits on the canvas, the drawing's rows and columns, not the DOM's nodes. */
const pointAt = (root: Element, node: Node, offset: number): Point | undefined => {
  const element = node instanceof Element ? node : (node.parentElement ?? undefined);
  if (element === undefined || !root.contains(element)) return undefined;
  const rows = [...root.children];
  if (rows.length === 0) return undefined;
  const row = closest(element, ROW);
  if (row === undefined) {
    // The edge landed on the drawing itself, whose offset counts rows and not characters.
    const at = Math.min(offset, rows.length - 1);
    return { row: at, column: offset > at ? startOf(rows[at], undefined) : 0 };
  }
  const at = rows.indexOf(row);
  if (at < 0) return undefined;
  if (node instanceof Element) {
    const cell = cellIn(node);
    if (cell === node) return { row: at, column: startOf(row, node) + (offset === 0 ? 0 : widthOf(node)) };
    const child = node.children[offset] ?? undefined;
    return { row: at, column: startOf(row, child === undefined ? undefined : cellIn(child)) };
  }
  const cell = closest(element, CELL);
  if (cell === undefined) return { row: at, column: 0 };
  return { row: at, column: startOf(row, cell) + displayWidth(node.textContent?.slice(0, offset) ?? "") };
};

const ordered = (one: Point, other: Point): readonly [Point, Point] =>
  one.row < other.row || (one.row === other.row && one.column <= other.column) ? [one, other] : [other, one];

/** The characters of a line whose own column opens inside `[from, to)`, a wide glyph taken whole or left whole. */
export const sliceCells = (line: string, from: number, to: number): string => {
  let column = 0;
  let out = "";
  for (const character of line) {
    if (column >= to) break;
    if (column >= from) out += character;
    column += displayWidth(character);
  }
  return out;
};

const TO_THE_END = Number.POSITIVE_INFINITY;

/** The text a selection between two points copies: the lines it runs through, or the block of columns it covers. */
export const pick = (plain: string, one: Point, other: Point, byColumn: boolean): string => {
  const [from, to] = ordered(one, other);
  const lines = plain.split(NEWLINE).slice(from.row, to.row + 1);
  if (lines.length === 0) return "";
  if (byColumn) {
    const left = Math.min(from.column, to.column);
    const right = Math.max(from.column, to.column);
    return lines.map((line) => sliceCells(line, left, right)).join(NEWLINE);
  }
  if (lines.length === 1) return sliceCells(lines[0], from.column, to.column);
  const last = lines.length - 1;
  return lines
    .map((line, index) =>
      index === 0 ? sliceCells(line, from.column, TO_THE_END) : index === last ? sliceCells(line, 0, to.column) : line
    )
    .join(NEWLINE);
};

const PLAIN_TEXT = "text/plain";

// Copies the lines a hand selection runs through, or with alt held at the drag, the columns it covers.
export function useSelectionCopy(display: RefObject<HTMLElement | null>, plain: string | undefined): void { // boundary: what React's `ref` holds before the node mounts
  const byColumn = useRef(false);

  useEffect(() => {
    const drawing = display.current ?? undefined;
    if (drawing === undefined || plain === undefined) return;

    // Alt is read at the drag, as a terminal does: a copy event carries no modifier.
    const started = (event: MouseEvent): void => {
      byColumn.current = event.altKey;
    };
    const held = (event: KeyboardEvent): void => {
      drawing.classList.toggle(BY_COLUMN, event.altKey);
    };
    const copied = (event: ClipboardEvent): void => {
      const selection = document.getSelection() ?? undefined;
      if (selection === undefined || selection.isCollapsed || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!drawing.contains(range.startContainer) || !drawing.contains(range.endContainer)) return;
      const from = pointAt(drawing, range.startContainer, range.startOffset);
      const to = pointAt(drawing, range.endContainer, range.endOffset);
      const data = event.clipboardData ?? undefined;
      if (from === undefined || to === undefined || data === undefined) return;
      data.setData(PLAIN_TEXT, pick(plain, from, to, byColumn.current));
      event.preventDefault();
    };

    drawing.addEventListener("mousedown", started);
    window.addEventListener("keydown", held);
    window.addEventListener("keyup", held);
    document.addEventListener("copy", copied);
    return () => {
      drawing.classList.remove(BY_COLUMN);
      drawing.removeEventListener("mousedown", started);
      window.removeEventListener("keydown", held);
      window.removeEventListener("keyup", held);
      document.removeEventListener("copy", copied);
    };
  }, [display, plain]);
}
