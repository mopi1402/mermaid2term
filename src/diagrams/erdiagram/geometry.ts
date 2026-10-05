import type { ERDiagram, Relationship, EndOffsets, Layout, PinnedEnds } from "./model.js";
import { must } from "../../must.js";
import { CORRIDOR_STEP, MARGIN, MARKER_ALONG, sideRow, clampAcross, clampOffset } from "./metrics.js";
import { packLanes } from "./offsets.js";

export interface RelGeometry {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  horizontal: boolean;
  forward: boolean;
  bend: number | undefined;
  corridor: number | undefined;
  flankOne: -1 | 1 | undefined;
  flankTwo: -1 | 1 | undefined;
}

export interface RoutingPlan {
  lanes: Map<number, number>;
  corridors: Map<number, number>;
}

export function planRouting(diagram: ERDiagram, layout: Layout, offsets: EndOffsets, isLR: boolean): RoutingPlan {
  const { lanes } = packLanes(diagram, layout, offsets, isLR);
  const corridors = new Map<number, number>();
  skipEdges(diagram, layout.layerOf).forEach((index, lane) => corridors.set(index, lane));
  return { lanes, corridors };
}

export function bandRows(layout: Layout, band: number): [number, number] {
  const bottom = Math.max(
    ...(layout.layers[band] ?? []).map((name) => {
      const [, y] = must(layout.positions.get(name));
      const [, h] = must(layout.sizes.get(name));
      return y + h;
    })
  );
  const top = Math.min(...(layout.layers[band + 1] ?? []).map((name) => (must(layout.positions.get(name)))[1]));
  return [bottom, top];
}

export function bandCols(layout: Layout, band: number): [number, number] {
  const right = Math.max(
    ...(layout.layers[band] ?? []).map((name) => {
      const [x] = must(layout.positions.get(name));
      const [w] = must(layout.sizes.get(name));
      return x + w;
    })
  );
  const left = Math.min(...(layout.layers[band + 1] ?? []).map((name) => (must(layout.positions.get(name)))[0]));
  return [right, left];
}

export function relationshipGeometry(
  rel: Relationship,
  index: number,
  layout: Layout,
  plan: RoutingPlan,
  offsets: EndOffsets,
  isLR: boolean,
  pinned: PinnedEnds | undefined = undefined
): RelGeometry | undefined {
  if (rel.entity1 === rel.entity2) return undefined;
  const { positions, sizes, layerOf } = layout;
  const source = positions.get(rel.entity1);
  const target = positions.get(rel.entity2);
  if (source === undefined || target === undefined) return undefined;

  const [sx, sy] = source;
  const [sw, sh] = must(sizes.get(rel.entity1));
  const [tx, ty] = target;
  const [tw, th] = must(sizes.get(rel.entity2));

  const sourceMidCol = sx + Math.floor(sw / 2);
  const sourceMidRow = sideRow(sy, sh);
  const targetMidCol = tx + Math.floor(tw / 2);
  const targetMidRow = sideRow(ty, th);

  const a = layerOf.get(rel.entity1) ?? -1;
  const b = layerOf.get(rel.entity2) ?? -2;
  const sameLayer = a === b;
  const clamp = clampOffset;
  const horizontal = isLR ? !sameLayer : sameLayer;
  const corridorLane = plan.corridors.get(index);

  const pinOne = pinned?.one ?? undefined;
  const pinTwo = pinned?.two ?? undefined;

  if (!isLR && corridorLane !== undefined) {
    return {
      startCol: sx - 1,
      startRow: pinOne === undefined ? sourceMidRow + clamp(offsets.exit.get(index) ?? 0, sh) : sideRow(sy + pinOne.spot.y, pinOne.spot.h),
      endCol: tx - 1,
      endRow: pinTwo === undefined ? targetMidRow + clamp(offsets.arrival.get(index) ?? 0, th) : sideRow(ty + pinTwo.spot.y, pinTwo.spot.h),
      horizontal: false,
      forward: targetMidRow > sourceMidRow,
      bend: undefined,
      corridor: MARGIN + layout.corridorInset + corridorLane * CORRIDOR_STEP,
      flankOne: undefined,
      flankTwo: undefined,
    };
  }

  if (isLR && corridorLane !== undefined) {
    return {
      startCol: pinOne === undefined ? sourceMidCol : sx + pinOne.spot.x + Math.floor(pinOne.spot.w / 2),
      startRow: sy - 1,
      endCol: pinTwo === undefined ? targetMidCol : tx + pinTwo.spot.x + Math.floor(pinTwo.spot.w / 2),
      endRow: ty - 1,
      horizontal: true,
      forward: targetMidCol > sourceMidCol,
      bend: undefined,
      corridor: MARGIN + layout.corridorInset + corridorLane * CORRIDOR_STEP,
      flankOne: undefined,
      flankTwo: undefined,
    };
  }

  const flankOne = pinOne?.flank ?? undefined;
  const flankTwo = pinTwo?.flank ?? undefined;
  // A flanked end stands just beside its box, any other one where its offset seats it along the face.
  const face = (flank: -1 | 1 | undefined, seated: number, near: number, far: number): number =>
    flank === undefined ? seated : flank < 0 ? near - 2 : far + 1;
  const bendAt = (start: number, end: number, band: () => [number, number], step: number): number | undefined => {
    const lane = plan.lanes.get(index);
    if (start === end || (lane === undefined && flankOne === undefined && flankTwo === undefined)) return undefined;
    return band()[0] + MARKER_ALONG + 1 + (lane ?? 0) * step;
  };

  if (!horizontal) {
    const downward = targetMidRow - sourceMidRow > 0;
    const startCol = face(flankOne, sourceMidCol + clampAcross(offsets.exit.get(index) ?? 0, sw), sx, sx + sw);
    const endCol = face(flankTwo, targetMidCol + clampAcross(offsets.arrival.get(index) ?? 0, tw), tx, tx + tw);
    const bend = bendAt(startCol, endCol, () => bandRows(layout, Math.min(a, b)), 1);
    return {
      startCol,
      startRow:
        flankOne === undefined
          ? downward
            ? sy + sh
            : sy - 1
          : sideRow(sy + (must(pinOne)).spot.y, (must(pinOne)).spot.h),
      endCol,
      endRow:
        flankTwo === undefined
          ? downward
            ? ty - 1
            : ty + th
          : sideRow(ty + (must(pinTwo)).spot.y, (must(pinTwo)).spot.h),
      horizontal,
      forward: downward,
      bend,
      corridor: undefined,
      flankOne,
      flankTwo,
    };
  }

  const rightward = targetMidCol - sourceMidCol > 0;
  const startRow = face(flankOne, sourceMidRow + clamp(offsets.exit.get(index) ?? 0, sh), sy, sy + sh);
  const endRow = face(flankTwo, targetMidRow + clamp(offsets.arrival.get(index) ?? 0, th), ty, ty + th);
  const bend = sameLayer ? undefined : bendAt(startRow, endRow, () => bandCols(layout, Math.min(a, b)), 2);
  return {
    startCol:
      flankOne === undefined
        ? rightward
          ? sx + sw
          : sx - 1
        : sx + (must(pinOne)).spot.x + Math.floor((must(pinOne)).spot.w / 2),
    startRow,
    endCol:
      flankTwo === undefined
        ? rightward
          ? tx - 1
          : tx + tw
        : tx + (must(pinTwo)).spot.x + Math.floor((must(pinTwo)).spot.w / 2),
    endRow,
    horizontal,
    forward: rightward,
    bend,
    corridor: undefined,
    flankOne,
    flankTwo,
  };
}

export function skipEdges(diagram: ERDiagram, layerOf: Map<string, number>): number[] {
  const indices: number[] = [];
  diagram.relationships.forEach((rel, index) => {
    const a = layerOf.get(rel.entity1);
    const b = layerOf.get(rel.entity2);
    if (a !== undefined && b !== undefined && Math.abs(a - b) >= 2) indices.push(index);
  });
  return indices;
}
