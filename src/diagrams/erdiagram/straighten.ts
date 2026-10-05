import type { Cardinality, ERDiagram, EndOffsets, Layout, PinnedEnds } from "./model.js";
import { must } from "../../must.js";
import { clampAcross, clampOffset, KEY_SEP, markerStride, STRAIGHT_PULL } from "./metrics.js";
import { adjacentDrops } from "./offsets.js";
import { holdsSide } from "./rule-seats.js";

export function straightenDrops(
  diagram: ERDiagram,
  layout: Layout,
  offsets: EndOffsets,
  isLR: boolean,
  pinned: Map<number, PinnedEnds> | undefined
): void {
  const { layerOf, sizes } = layout;
  const faceKey = (name: string, towardHigher: boolean): string => `${name}${KEY_SEP}${towardHigher ? "v" : "^"}`;
  const drops = new Map<string, Array<{ index: number; exit: boolean; at: number }>>();
  const spans = new Map<number, [number, number]>();
  for (const { rel, index, a, b, span } of adjacentDrops(diagram, layout, offsets, isLR)) {
    spans.set(index, span);
    for (const [face, exit, at] of [
      [faceKey(rel.entity1, a < b), true, span[0]] as const,
      [faceKey(rel.entity2, b < a), false, span[1]] as const,
    ]) {
      const list = drops.get(face) ?? [];
      list.push({ index, exit, at });
      drops.set(face, list);
    }
  }
  const seats = (name: string, off: number, card: Cardinality): boolean => {
    const [w, h] = must(sizes.get(name));
    if (!isLR) return clampAcross(off, w) === off;
    return clampOffset(off, h) === off && holdsSide(must(diagram.entities.get(name)), h, off, card);
  };
  const fits = (face: string, index: number, at: number): boolean =>
    (drops.get(face) ?? []).every((d) => d.index === index || Math.abs(d.at - at) >= markerStride(isLR));
  diagram.relationships.forEach((rel, index) => {
    const span = spans.get(index);
    if (span === undefined || span[0] === span[1]) return;
    const a = must(layerOf.get(rel.entity1));
    const b = must(layerOf.get(rel.entity2));
    const tryMove = (exit: boolean, to: number): boolean => {
      if (Math.abs(to - (exit ? span[0] : span[1])) > STRAIGHT_PULL) return false;
      const name = exit ? rel.entity1 : rel.entity2;
      const face = exit ? faceKey(rel.entity1, a < b) : faceKey(rel.entity2, b < a);
      const map = exit ? offsets.exit : offsets.arrival;
      const from = exit ? span[0] : span[1];
      const wanted = (map.get(index) ?? 0) + (to - from);
      if (!seats(name, wanted, exit ? rel.card1 : rel.card2) || !fits(face, index, to)) return false;
      map.set(index, wanted);
      const entry = (drops.get(face) ?? []).find((d) => d.index === index && d.exit === exit);
      if (entry !== undefined) entry.at = to;
      spans.set(index, exit ? [to, span[1]] : [span[0], to]);
      return true;
    };
    if (pinned?.has(index) === true) return;
    if (!tryMove(true, span[1])) tryMove(false, span[0]);
  });
}
