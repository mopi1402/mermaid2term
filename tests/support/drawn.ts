import { NEWLINE } from "../../src/text/chars.js";
import { displayWidth } from "../../src/text/width.js";

// The widths a kind is read at: a narrow pane and a standard terminal, then a wide one on top.
export const TWO_PANES = [40, 80] as const;
export const THREE_PANES = [40, 80, 120] as const;

export const rowsOf = (drawn: string): string[] => drawn.split(NEWLINE);

// The rows above the first blank one: the title a drawing opens on.
export const headOf = (drawn: string): string[] => {
  const rows = rowsOf(drawn);
  return rows.slice(0, rows.findIndex((row) => row.trim() === ""));
};

// The widest row, in terminal columns.
export const widest = (drawn: string): number => Math.max(...rowsOf(drawn).map(displayWidth));
