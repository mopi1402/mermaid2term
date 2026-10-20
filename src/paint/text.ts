import { NEWLINE, withoutControls } from "../text/chars.js";
import type { Background } from "../colour/background.js";
import { renderCells } from "./emit.js";
import { STYLE_SEPARATOR, UNDERLINE } from "./tokens.js";
import {
  NO_CELL_STYLE,
  cellLen,
  cellsPlain,
  cropToCells,
  divideLine,
  expandTabs,
  rstripEnd,
  splitCells,
  type Cell,
} from "./cells.js";

export class Text {
  private readonly cells: Cell[];
  private painted = false;

  constructor(plain: string) {
    this.cells = [...withoutControls(plain)].map((ch) => ({ ch, style: NO_CELL_STYLE }));
  }

  paintedForGround(): Text {
    this.painted = true;
    return this;
  }

  get isPainted(): boolean {
    return this.painted;
  }

  get plain(): string {
    return cellsPlain(this.cells);
  }

  static stacked(above: Text, below: Text): Text {
    const text = new Text("");
    text.cells.push(...above.cells, { ch: NEWLINE, style: NO_CELL_STYLE }, ...below.cells);
    text.painted = above.painted || below.painted;
    return text;
  }

  fromRow(row: number): Text {
    let at = 0;
    for (let dropped = 0; dropped < row && at < this.cells.length; at++) {
      if (this.cells[at].ch === NEWLINE) dropped += 1;
    }
    const text = new Text("");
    text.cells.push(...this.cells.slice(at));
    text.painted = this.painted;
    return text;
  }

  // The rows on top holding nothing at all, neither a mark nor a painted ground.
  get blankTop(): number {
    let rows = 0;
    for (const cell of this.cells) {
      if (cell.ch === NEWLINE) rows += 1;
      else if (cell.ch.trim() !== "" || cell.style !== NO_CELL_STYLE) return rows;
    }
    return 0;
  }

  stylize(style: string, start: number, end: number): void {
    for (let at = start; at < end && at < this.cells.length; at++) {
      this.cells[at] = { ...(this.cells[at]), style };
    }
  }

  // The owner, the link and the style of a painted run, in one write per cell; a style left out keeps the cell's.
  lay(owner: string, url: string | undefined, style: string | undefined, start: number, end: number): void {
    for (let at = start; at < end && at < this.cells.length; at++) {
      const { ch, style: kept } = this.cells[at];
      const laid = style ?? kept;
      this.cells[at] = url === undefined ? { ch, style: laid, owner } : { ch, style: laid, owner, link: url };
    }
  }

  // mermaid underlines a label as one run of text: the blanks between two underlined words of one label carry it too.
  bridgeUnderlines(): void {
    const underlined = (cell: Cell): boolean => cell.style.split(STYLE_SEPARATOR).includes(UNDERLINE);
    let word = -1;
    this.cells.forEach((cell, at) => {
      if (cell.ch === NEWLINE) word = -1;
      if (cell.ch.trim() === "") return;
      const before = this.cells[word];
      if (before !== undefined && at - word > 1 && before.owner === cell.owner && underlined(before) && underlined(cell)) {
        for (let blank = word + 1; blank < at; blank++) {
          const { style } = this.cells[blank];
          if (!underlined(this.cells[blank])) this.cells[blank] = { ...this.cells[blank], style: `${UNDERLINE}${STYLE_SEPARATOR}${style}`.trim() };
        }
      }
      word = at;
    });
  }

  // Each row's cells as painted, with the style laid on each and the key it was painted from.
  get rows(): ReadonlyArray<readonly Cell[]> {
    return splitCells(this.cells);
  }

  toAnsi(background?: Background): string {
    return renderCells(this.cells, this.painted ? undefined : background);
  }

  wrap(width: number, fold: boolean = true): Cell[][] {
    const out: Cell[][] = [];
    for (const raw of splitCells(this.cells)) {
      const line = expandTabs(raw);
      const offsets = divideLine(line, width, fold);
      const pieces: Cell[][] = [];
      let previous = 0;
      for (const offset of offsets) {
        pieces.push(line.slice(previous, offset));
        previous = offset;
      }
      pieces.push(line.slice(previous));
      for (const piece of pieces) {
        const trimmed = rstripEnd(piece, width);
        out.push(cellLen(trimmed) > width ? cropToCells(trimmed, width) : trimmed);
      }
    }
    return out;
  }
}
