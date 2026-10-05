import { type ClassDef } from "./model.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { fillHex, styleBox } from "../../canvas/frame-style.js";
import { NODE, wordKey } from "../../canvas/keys.js";
import { boxSize } from "./class-box.js";
import { layBoxBand } from "../../canvas/fit-frame.js";

export function styleClassBox(
  canvas: Canvas,
  x: number,
  y: number,
  cls: ClassDef,
  props: ReadonlyMap<string, string>,
  classed: ReadonlyMap<string, string> | undefined,
  cs: CharSet,
  paddingX: number,
  hideEmpty: boolean
): void {
  const [width, height] = boxSize(cls, paddingX, hideEmpty);
  styleBox(canvas, { x, y, w: width, h: height }, props, classed, cs, wordKey);
}

// The GROUND, laid over the whole box once everything else is drawn: mermaid fills the rect and strokes its outline
// on top of the fill, so a frame row carrying the page instead of the box's own colour reads as a blank line cut
// through the cartouche. The band goes on LAST because it has to sit at the end of the key, where the painter reads it.
// Under `borders: padless` the side columns keep the page, an eighth's other seven lying outside the box.
export function bandClassBox(
  canvas: Canvas,
  x: number,
  y: number,
  cls: ClassDef,
  props: ReadonlyMap<string, string> | undefined,
  paddingX: number,
  hideEmpty: boolean,
  padless: boolean
): void {
  if (cls.lollipop) return;
  const [width, height] = boxSize(cls, paddingX, hideEmpty);
  const band = fillHex(props) ?? NODE;
  layBoxBand(canvas, y, y + height - 1, x, x + width - 1, band, padless);
}
