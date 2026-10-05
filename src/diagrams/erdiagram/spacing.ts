import { type ERDiagram } from "./model.js";
import { widestLabelLine } from "../../text/labels.js";
import { must } from "../../must.js";
import { BASE_CROSS_GAP, KEY_SEP, LABEL_AIR, labelRoom, MARKER_ACROSS, MARKER_ALONG, markerStride, MIN_EDGE_GAP, seatsAcross } from "./metrics.js";
import { boxSize } from "./entity-box.js";
import { sameLayerGaps } from "../@common/box-diagram.js";

export function sizeBoxes(
  diagram: ERDiagram,
  layerOf: Map<string, number>,
  sizes: Map<string, [number, number]>,
  slots: Map<string, number> | undefined,
  blockSizes: Map<string, [number, number]> | undefined,
  paddingX: number,
  gap: number,
  airy: boolean,
  isLR: boolean
): void {
  for (const [name, entity] of diagram.entities) sizes.set(name, blockSizes?.get(name) ?? boxSize(entity, paddingX, gap, airy));
  if (isLR) {
    for (const [key, count] of facePlugs(diagram, layerOf)) {
      if (count < 2) continue;
      const name = key.slice(0, key.indexOf(KEY_SEP));
      if (blockSizes?.has(name) === true) continue;
      const [w, h] = must(sizes.get(name));
      sizes.set(name, [w, Math.max(h, 2 + count * MARKER_ACROSS + (count - 1))]);
    }
  } else widenForEnds(diagram, layerOf, sizes, blockSizes);
  if (slots !== undefined) {
    const widest = Math.max(...[...sizes.values()].map(([w]) => w));
    for (const [name, [, h]] of sizes) if (blockSizes?.has(name) !== true) sizes.set(name, [widest, h]);
  }
}

// How many lines plug into each face of a box, a face keyed by the box and the side toward the next layer.
function facePlugs(diagram: ERDiagram, layerOf: Map<string, number>): Map<string, number> {
  const plugs = new Map<string, number>();
  for (const rel of diagram.relationships) {
    const a = layerOf.get(rel.entity1);
    const b = layerOf.get(rel.entity2);
    if (a === undefined || b === undefined || Math.abs(a - b) !== 1) continue;
    for (const [name, face] of [[rel.entity1, a < b], [rel.entity2, b < a]] as const) {
      const key = `${name}${KEY_SEP}${face ? "after" : "before"}`;
      plugs.set(key, (plugs.get(key) ?? 0) + 1);
    }
  }
  return plugs;
}

// Down the page a face holds its ends a stride apart, each figure a column clear of the corner past it.
function widenForEnds(
  diagram: ERDiagram,
  layerOf: Map<string, number>,
  sizes: Map<string, [number, number]>,
  blockSizes: Map<string, [number, number]> | undefined
): void {
  for (const [key, count] of facePlugs(diagram, layerOf)) {
    const name = key.slice(0, key.indexOf(KEY_SEP));
    if (blockSizes?.has(name) === true) continue;
    const reach = Math.trunc(((count - 1) / 2) * markerStride(false));
    let [w, h] = must(sizes.get(name));
    while (!seatsAcross(-reach, w) || !seatsAcross(reach, w)) w++;
    sizes.set(name, [w, h]);
  }
}

export interface RelationGaps {
  pairGap: Map<string, number>;
  crossLayerGap: number;
}

export function relationGaps(
  diagram: ERDiagram,
  layerOf: Map<string, number>,
  gap: number,
  isLR: boolean
): RelationGaps {
  const cardRoom = MARKER_ALONG + MARKER_ALONG + 1;
  const pairGap = sameLayerGaps(diagram.relationships, (rel) => [rel.entity1, rel.entity2], layerOf, gap, (rel) =>
    Math.max(
      rel.label !== "" ? widestLabelLine(rel.label) + (isLR ? 0 : LABEL_AIR) + Math.max(labelRoom(gap), 2) + 2 * MARKER_ALONG : gap,
      cardRoom,
      gap,
      MIN_EDGE_GAP
    )
  );

  let crossLayerGap = gap;
  for (const rel of diagram.relationships) {
    const source = layerOf.get(rel.entity1);
    const target = layerOf.get(rel.entity2);
    if (source === undefined || target === undefined || source === target) continue;
    const room = Math.max(labelRoom(gap), 1);
    let needed = Math.max(BASE_CROSS_GAP, MARKER_ALONG + MARKER_ALONG + room);
    if (rel.label !== "") needed = Math.max(needed, widestLabelLine(rel.label) + (isLR ? LABEL_AIR : 0) + Math.max(labelRoom(gap), 2) + 2 * MARKER_ALONG);
    crossLayerGap = Math.max(crossLayerGap, needed);
  }
  return { pairGap, crossLayerGap };
}

