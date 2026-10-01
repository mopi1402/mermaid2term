import { HYPERLINK_CLOSE, RESET, hyperlinkOpen, sgr } from "./escapes.js";
import { styleCodes } from "./sgr.js";
import { NO_CELL_STYLE, type Cell } from "./cells.js";
import type { Background } from "../colour/background.js";
import { ensured } from "../must.js";

export type CodesOf = (style: string) => string;

// One parse per distinct style: a drawing repeats a few dozen definitions over thousands of cells.
export function codesCache(background?: Background): CodesOf {
  const codesOf = new Map<string, string>();
  return (style) => ensured(codesOf, style, () => styleCodes(style, background));
}

export function renderCells(cells: readonly Cell[], background?: Background, codesFor: CodesOf = codesCache(background)): string {
  let out = "";
  let bare = "";
  let open: string | undefined;
  const close = (): void => {
    if (open === undefined) return;
    out += RESET;
    open = undefined;
  };
  let linked: string | undefined;
  const relink = (url: string | undefined): void => {
    if (url === linked) return;
    close();
    out += bare;
    bare = "";
    if (linked !== undefined) out += HYPERLINK_CLOSE;
    if (url !== undefined) out += hyperlinkOpen(url);
    linked = url;
  };
  for (const cell of cells) {
    relink(cell.link ?? undefined);
    if (cell.style === NO_CELL_STYLE) {
      close();
      bare += cell.ch;
      continue;
    }
    const codes = codesFor(cell.style);
    if (open !== undefined && open === codes) {
      out += cell.ch;
      continue;
    }
    close();
    out += bare;
    bare = "";
    if (codes === "") {
      out += cell.ch;
      continue;
    }
    out += sgr(codes) + cell.ch;
    open = codes;
  }
  close();
  relink(undefined);
  return out + bare;
}

