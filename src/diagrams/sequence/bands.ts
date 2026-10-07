import { type BandArms, type CharSet } from "../../canvas/model.js";
import { type FlatEvent } from "./events.js";
import { pushInto } from "../../must.js";

export function computeActivationRanges(
  flat: FlatEvent[],
  rowAt: (index: number) => number,
  lastRow: number
): Map<string, Array<[number, number]>> {
  const open = new Map<string, number[]>();
  const ranges = new Map<string, Array<[number, number]>>();

  const record = (id: string, range: [number, number]): void => pushInto(ranges, id, range);

  flat.forEach((event, index) => {
    if (event.type !== "activate") return;
    const row = rowAt(index);
    if (event.active) {
      const starts = open.get(event.participant);
      if (starts === undefined) open.set(event.participant, [row]);
      else starts.push(row);
      return;
    }
    const starts = open.get(event.participant);
    const start = starts?.pop();
    if (start !== undefined) record(event.participant, [start, row]);
  });

  for (const [id, starts] of open) for (const start of starts) record(id, [start, lastRow]);

  return ranges;
}

type BandPart = "top" | "bottom" | "middle";

export interface BandCell {
  readonly part: BandPart;
  readonly extra: number;
}

export const bandCellOf = (ranges: Array<[number, number]>, row: number): BandCell | undefined => {
  let depth = 0;
  let outermost: [number, number] | undefined;
  for (const range of ranges) {
    const [start, end] = range;
    if (row < start || row > end) continue;
    depth += 1;
    if (outermost === undefined || start < (outermost[0])) outermost = range;
  }
  if (outermost === undefined) return undefined;
  const [start, end] = outermost;
  const part: BandPart = row === start && row !== end ? "top" : row === end && row !== start ? "bottom" : "middle";
  return { part, extra: depth - 1 };
};

export const bandGlyph = (cell: BandCell, arm: keyof BandArms, cs: CharSet): string => {
  const filled = cell.extra > 0 && arm === "none";
  if (filled) return cs.bandFill;
  return cs.band[cell.part][arm];
};
