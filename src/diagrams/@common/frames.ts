import { type Canvas } from "../../canvas/canvas.js";
import { fillCluster, type CellRect } from "../../canvas/cluster.js";
import { widenFrame } from "../../canvas/fit-frame.js";
import { type FrameBox } from "../../canvas/frame-style.js";
import { WALL_TAIL } from "../../canvas/keys.js";

// mermaid's `.cluster rect` lays `clusterBkg` inside a subgraph; padless moves the walls onto the cells' outer edges
// so the ground meets them. Every wall moves before any ground is laid, a nested frame keeping its own.
export function groundFrames(canvas: Canvas, frames: readonly FrameBox[], padless: boolean): void {
  if (padless) {
    for (const f of frames) widenFrame(canvas, f.y, f.y + f.h - 1, f.x, f.x + f.w - 1, canvas.getStyle(f.y, f.x), false, WALL_TAIL);
  }
  // Every frame lays the same ground, so a cell another frame already grounded is skipped, nested ones included.
  const laid: CellRect[] = [];
  for (const f of frames) {
    const grounded = fillCluster(canvas, f.x, f.y, f.w, f.h, 1, 1, laid);
    if (grounded !== undefined) laid.push(grounded);
  }
}
