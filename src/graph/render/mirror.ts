import { Direction, type Graph } from "../model.js";
import { AttachDir } from "../sides.js";
import { type RoutedEdge } from "../routing/routed.js";
import { type GridLayout } from "../layout/grid.js";
import { everySubgraph } from "../subgraph-tree.js";
import { DrumAnchor, DrumRim } from "../layout/laid.js";
import { must } from "../../must.js";
export function mirrorSubgraphDirections(graph: Graph, vertical: boolean): void {
  const upright: Record<string, Direction> = {
    [Direction.TB]: Direction.BT,
    [Direction.TD]: Direction.BT,
    [Direction.BT]: Direction.TB,
  };
  const flat: Record<string, Direction> = { [Direction.LR]: Direction.RL, [Direction.RL]: Direction.LR };
  const table = vertical ? upright : flat;
  for (const sg of everySubgraph(graph)) {
    if (sg.direction === undefined) continue;
    sg.direction = table[sg.direction] ?? sg.direction;
  }
}

const MIRRORED_DIR: ReadonlyMap<AttachDir, AttachDir> = new Map([
  [AttachDir.LEFT, AttachDir.RIGHT],
  [AttachDir.RIGHT, AttachDir.LEFT],
  [AttachDir.TOP, AttachDir.BOTTOM],
  [AttachDir.BOTTOM, AttachDir.TOP],
]);

// Where a span of `size` starting at `at` lands once a line `extent` long is read backwards.
export const mirrorAt = (at: number, size: number, extent: number): number => extent - at - size;

export function mirrorGeometry(layout: GridLayout, routed: readonly RoutedEdge[], width: number, height: number, vertical: boolean): void {
  const across = (x: number, w: number): number => mirrorAt(x, w, width);
  const down = (y: number, h: number): number => mirrorAt(y, h, height);
  for (const p of layout.placements.values()) {
    if (vertical) p.drawY = down(p.drawY, p.drawHeight);
    else p.drawX = across(p.drawX, p.drawWidth);
  }
  for (const sb of layout.subgraphBounds) {
    if (vertical) sb.y = down(sb.y, sb.height);
    else sb.x = across(sb.x, sb.width);
  }
  const turned = (dir: AttachDir): AttachDir => {
    const other = must(MIRRORED_DIR.get(dir));
    const onAxis = vertical ? dir === AttachDir.TOP || dir === AttachDir.BOTTOM : dir === AttachDir.LEFT || dir === AttachDir.RIGHT;
    return onAxis ? other : dir;
  };
  for (const re of routed) {
    for (const point of re.drawPath) {
      if (vertical) point[1] = down(point[1], 1);
      else point[0] = across(point[0], 1);
    }
    re.startDir = turned(re.startDir);
    re.endDir = turned(re.endDir);
  }
  if (vertical) {
    for (const [id, seat] of layout.drums) {
      layout.drums.set(id, {
        ...seat,
        rim: seat.rim === DrumRim.ABOVE ? DrumRim.BELOW : DrumRim.ABOVE,
        anchor: seat.anchor === DrumAnchor.TOP ? DrumAnchor.BOTTOM : seat.anchor === DrumAnchor.BOTTOM ? DrumAnchor.TOP : seat.anchor,
      });
    }
  }
}

// Every box, frame and run moved `rows` down, the room a label taller than a row may need above the top one.
export function lowerGeometry(layout: GridLayout, routed: readonly RoutedEdge[], rows: number): void {
  for (const p of layout.placements.values()) p.drawY += rows;
  for (const sb of layout.subgraphBounds) sb.y += rows;
  for (const re of routed) for (const point of re.drawPath) point[1] += rows;
}

export function rightGeometry(layout: GridLayout, routed: readonly RoutedEdge[], cols: number): void {
  for (const p of layout.placements.values()) p.drawX += cols;
  for (const sb of layout.subgraphBounds) sb.x += cols;
  for (const re of routed) for (const point of re.drawPath) point[0] += cols;
}
