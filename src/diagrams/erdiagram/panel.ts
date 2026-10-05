import { centredAt, centredOffset, displayWidth } from "../../text/width.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { type Block, type Spot } from "./model.js";
import { SUBGRAPH } from "../../canvas/keys.js";
import { seatTitle } from "../../canvas/frame-style.js";
import { clusterFrame } from "../../canvas/shape-frame.js";

const GROUP_SIDE = 2;

const GROUP_HEAD = 3;

const GROUP_FOOT = 2;

export function framedPanel(content: { canvas: Canvas; spots: Map<string, Spot>; frames: Map<string, Spot> }, title: string, cs: CharSet): Block {
  const drawing = content.canvas;
  const width = Math.max(drawing.width + GROUP_SIDE * 2, displayWidth(title) + GROUP_SIDE * 2);
  const height = drawing.height + GROUP_HEAD + GROUP_FOOT;
  const panel = new Canvas(width, height);
  clusterFrame(panel, 0, 0, width, height, cs, SUBGRAPH);
  const dx = centredOffset(width, drawing.width);
  panel.stamp(drawing, GROUP_HEAD, dx);
  const spots = new Map<string, Spot>();
  for (const [name, spot] of content.spots) spots.set(name, { ...spot, x: spot.x + dx, y: spot.y + GROUP_HEAD });
  const frames = new Map<string, Spot>();
  for (const [name, spot] of content.frames) frames.set(name, { ...spot, x: spot.x + dx, y: spot.y + GROUP_HEAD });
  return { panel, title, spots, frames };
}

// Seated once the lines crossing the frame are drawn, so the title steps aside from them as a graph cluster's does.
export function seatPanelTitle(canvas: Canvas, block: Block, x: number, y: number): void {
  const width = block.panel.width;
  seatTitle(canvas, [[y + 1, x + centredAt(width, block.title), block.title]], x + 1, x + width - 1, false);
}
