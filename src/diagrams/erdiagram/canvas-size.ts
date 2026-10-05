import type { ERDiagram, PinnedEnds, EndOffsets, Layout } from "./model.js";
import { widestLabelLine } from "../../text/labels.js";
import { must } from "../../must.js";
import { LABEL_AIR, MARGIN, sideRow, clampAcross } from "./metrics.js";
import { stampedWidth } from "../../canvas/chip.js";
import { nestsOf } from "./loop-nest.js";
import { loopReach } from "./self-loop.js";

export function grownCanvasSize(
  diagram: ERDiagram,
  layout: Layout,
  offsets: EndOffsets,
  pinned: Map<number, PinnedEnds> | undefined,
  isLR: boolean
): [number, number] {
  let width = layout.width;
  const nests = nestsOf(diagram);
  diagram.relationships.forEach((rel, index) => {
    const source = layout.positions.get(rel.entity1);
    const target = layout.positions.get(rel.entity2);
    if (source === undefined || target === undefined) return;
    const [sw, sh] = must(layout.sizes.get(rel.entity1));
    const [tw, th] = must(layout.sizes.get(rel.entity2));
    if (nests.has(rel.entity1) && rel.entity1 === rel.entity2) {
      width = Math.max(width, loopReach(diagram, layout, rel, index)[0] + MARGIN);
      return;
    }
    if (rel.entity1 === rel.entity2) {
      const chip = rel.label === "" ? 0 : stampedWidth(rel.label);
      width = Math.max(width, source[0] + sw + Math.max(4, chip + 5) + MARGIN);
      return;
    }
    const ends = pinned?.get(index);
    if (!isLR && (ends?.one?.flank !== undefined || ends?.two?.flank !== undefined)) {
      const laneOne = ends?.one?.flank === undefined ? undefined : ends.one.flank < 0 ? source[0] - 2 : source[0] + sw + 1;
      const laneTwo = ends?.two?.flank === undefined ? undefined : ends.two.flank < 0 ? target[0] - 2 : target[0] + tw + 1;
      for (const lane of [laneOne, laneTwo]) if (lane !== undefined) width = Math.max(width, lane + 2);
      if (rel.label !== "") {
        const from = laneOne ?? source[0] + Math.floor(sw / 2) + clampAcross(offsets.exit.get(index) ?? 0, sw);
        const to = laneTwo ?? target[0] + Math.floor(tw / 2) + clampAcross(offsets.arrival.get(index) ?? 0, tw);
        const chip = stampedWidth(rel.label);
        if (Math.abs(to - from) + 1 < chip + 2 + LABEL_AIR) width = Math.max(width, to + 4 + widestLabelLine(rel.label));
      }
    }
    const sourceMid = source[0] + Math.floor(sw / 2) + (offsets.exit.get(index) ?? 0);
    const targetMid = target[0] + Math.floor(tw / 2) + (offsets.arrival.get(index) ?? 0);
    const edge = Math.max(sourceMid, targetMid);
    const onRun = sideRow(source[1], sh) === sideRow(target[1], th);
    if (rel.label !== "" && !onRun) width = Math.max(width, edge + 2 + widestLabelLine(rel.label) + MARGIN);
    width = Math.max(width, edge + 1 + 1 + MARGIN);
  });
  let height = layout.height;
  diagram.relationships.forEach((rel, index) => {
    const ends = pinned?.get(index);
    for (const [name, flank] of [
      [rel.entity1, ends?.one?.flank],
      [rel.entity2, ends?.two?.flank],
    ] as const) {
      if (!isLR || flank !== 1) continue;
      const at = layout.positions.get(name);
      const size = layout.sizes.get(name);
      if (at !== undefined && size !== undefined) height = Math.max(height, at[1] + size[1] + 2);
    }
    if (rel.entity1 !== rel.entity2) return;
    const at = layout.positions.get(rel.entity1);
    const size = layout.sizes.get(rel.entity1);
    if (at === undefined || size === undefined) return;
    height = Math.max(height, nests.has(rel.entity1) ? loopReach(diagram, layout, rel, index)[1] : at[1] + size[1] + 3);
  });
  return [width, height];
}

