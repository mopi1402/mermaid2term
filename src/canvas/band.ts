import { type Canvas } from "./canvas.js";
import { BAND_MARK, bandApart } from "./keys.js";

// A ground laid over a rectangle as a band at the end of each key, where the painter reads it, in place of any band
// the cell already had. `under` lays it beneath one already there instead: that cell keeps its own.
export function layBand(canvas: Canvas, top: number, bottom: number, left: number, right: number, band: string, under = false): void {
  for (let r = Math.max(0, top); r <= Math.min(bottom, canvas.height - 1); r++) {
    for (let c = Math.max(0, left); c <= Math.min(right, canvas.width - 1); c++) {
      const key = canvas.getStyle(r, c);
      const [base, had] = bandApart(key);
      if (under && had !== "") continue;
      canvas.setStyle(r, c, base + BAND_MARK + band);
    }
  }
}
