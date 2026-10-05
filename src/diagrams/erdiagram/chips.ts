import type { ERDiagram, EndOffsets, Layout } from "./model.js";
import { stampedWidth } from "../../canvas/chip.js";
import { adjacentDrops } from "./offsets.js";
import { KEY_SEP } from "./metrics.js";

export function planChips(
  diagram: ERDiagram,
  layout: Layout,
  offsets: EndOffsets,
  isLR: boolean
): Map<number, { top: boolean; at: number }> {
  const chips = new Map<number, { top: boolean; at: number }>();
  if (isLR) return chips;
  interface ChipItem {
    index: number;
    band: number;
    upper: number;
    lower: number;
    width: number;
    upFace: string;
    downFace: string;
  }
  const items: ChipItem[] = [];
  const strokes = new Map<number, Array<{ index: number; upper: number; lower: number; upFace: string; downFace: string }>>();
  for (const { rel, index, a, b, span } of adjacentDrops(diagram, layout, offsets, isLR)) {
    const band = Math.min(a, b);
    const upper = a < b ? span[0] : span[1];
    const lower = a < b ? span[1] : span[0];
    const upFace = a < b ? rel.entity1 : rel.entity2;
    const downFace = a < b ? rel.entity2 : rel.entity1;
    const list = strokes.get(band) ?? [];
    list.push({ index, upper, lower, upFace, downFace });
    strokes.set(band, list);
    if (rel.label !== "")
      items.push({ index, band, upper, lower, upFace, downFace, width: stampedWidth(rel.label) });
  }
  const claimed = new Map<string, Array<readonly [number, number]>>();
  for (const item of items) {
    const near = strokes.get(item.band) ?? [];
    const place = (top: boolean): number | undefined => {
      const anchor = top ? item.upper : item.lower;
      const key = `${item.band}${KEY_SEP}${top ? "t" : "b"}`;
      const held = claimed.get(key) ?? [];
      const foreign = near.filter((line) => line.index !== item.index).map((line) => (top ? line.upper : line.lower));
      const clear = (start: number): boolean =>
        held.every(([from, to]) => start > to + 1 || start + item.width - 1 < from - 1) &&
        foreign.every((col) => col < start - 1 || col > start + item.width);
      const lo = Math.max(0, anchor - item.width + 1);
      // The canvas grows to hold a chip hung right of its line, so the right edge is no bound.
      const hi = anchor;
      const ideal = anchor - Math.floor((item.width - 1) / 2);
      let best: number | undefined;
      for (let start = lo; start <= hi; start++) {
        if (clear(start) && (best === undefined || Math.abs(start - ideal) < Math.abs(best - ideal))) best = start;
      }
      if (best !== undefined) claimed.set(key, [...held, [best, best + item.width - 1]]);
      return best;
    };
    const fanUp = near.filter((line) => line.upFace === item.upFace).length;
    const fanDown = near.filter((line) => line.downFace === item.downFace).length;
    const preferTop = !(fanUp > 1 && fanDown === 1);
    const first = place(preferTop);
    if (first !== undefined) {
      chips.set(item.index, { top: preferTop, at: first });
      continue;
    }
    const second = place(!preferTop);
    if (second !== undefined) {
      chips.set(item.index, { top: !preferTop, at: second });
      continue;
    }
    const anchor = preferTop ? item.upper : item.lower;
    chips.set(item.index, { top: preferTop, at: Math.max(0, anchor - Math.floor((item.width - 1) / 2)) });
  }
  return chips;
}

export const NO_PIERCE = { one: false, two: false };
