import type { Canvas } from "../../canvas/canvas.js";
import type { CharSet } from "../../canvas/model.js";
import type { Scale } from "./scale.js";

export interface Scene {
  readonly canvas: Canvas;
  readonly cs: CharSet;
  readonly scale: Scale;
  readonly compact: boolean;
  readonly chartTop: number;
  readonly held: Set<number>;
  // A bar one cell wide: a `vert` line crossing it would leave nothing of it, where mermaid's line is drawn over a bar still seen.
  readonly solo: Set<number>;
}

export const holdCell = (scene: Scene, row: number, col: number): void => {
  scene.held.add(row * scene.scale.drawnWidth + col);
};
export const markSolo = (scene: Scene, row: number, col: number): void => {
  scene.solo.add(row * scene.scale.drawnWidth + col);
};
export const isSolo = (scene: Scene, row: number, col: number): boolean =>
  scene.solo.has(row * scene.scale.drawnWidth + col);
export const isHeld = (scene: Scene, row: number, col: number): boolean =>
  scene.held.has(row * scene.scale.drawnWidth + col);
