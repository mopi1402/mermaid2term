import { type LabelSegment, richRows, segmentsWidth, wrapSegments } from "../../source/markdown.js";
import { type MindmapNode } from "./model.js";
import { CHIP_PAD } from "../../canvas/chip.js";

// A run of text with the ink mermaid's markdown reading gives it, and the key it is painted under.
export interface Piece extends LabelSegment {
  readonly key?: string;
}

export type Row = Piece[];

const ICON_PREFIX_RE = /^[a-z]+-/u;

export const run = (text: string, key?: string): Piece =>
  key === undefined ? { text, bold: false, italic: false } : { text, bold: false, italic: false, key };

const keyed = (rows: readonly Row[], key: string): Row[] => rows.map((row) => row.map((piece) => ({ ...piece, key })));

// A node's rows as a chip: each row between one blank of the node's ground either side.
export const chipRows = (rows: readonly Row[], key: string): Row[] =>
  keyed(rows, key).map((row) => [run(CHIP_PAD, key), ...row, run(CHIP_PAD, key)]);

export const rowWidth = (row: Row): number => segmentsWidth(row);

function iconGlyph(icon: string | undefined, icons: Readonly<Record<string, string>>): string {
  if (icon === undefined) return "";
  const name = (icon.split(/\s+/u).pop() ?? "").replace(ICON_PREFIX_RE, "");
  return icons[name] ?? "";
}

// Every mindmap node is `labelType: 'markdown'` in mermaid: bold and italic read with or without the fence,
// `<br>` and a line end inside a string break the text, and the icon, where a glyph stands for it, leads it.
export function labelRows(node: MindmapNode, icons: Readonly<Record<string, string>>, cap: number): Row[] {
  const glyph = iconGlyph(node.icon, icons);
  // The glyph wraps with the first line's words, so its width counts in the cap; mermaid wraps at `maxNodeWidth`.
  return richRows(node.label).flatMap((runs, at) => wrapSegments(at === 0 && glyph !== "" ? [run(glyph), ...runs] : runs, cap));
}
