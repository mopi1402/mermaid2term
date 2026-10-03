import { describe, expect, it } from "vitest";

import { renderThemed } from "../../src/index.js";
import { QUIET_RATIO, contrastRatio } from "../../src/colour/contrast.js";
import { rgbOf, runsOf } from "../support/ansi.js";

const MARKS = "⭘◯○◎◆◇";

// Each mark with the ink it is written in and the fill it stands on.
const marksOf = (painted: string): Array<{ fg: ReturnType<typeof rgbOf>; bg: ReturnType<typeof rgbOf> }> =>
  runsOf(painted)
    .filter(([, text]) => [...text].some((ch) => MARKS.includes(ch)))
    .map(([codes]) => ({ fg: rgbOf(codes, "38"), bg: rgbOf(codes, "48") }));

describe("the mark that names a circle or a rhombus drawn as a box reads against the box's own fill", () => {
  it.each([
    ["base", "dark", "LR"],
    ["base", "dark", "TD"],
    ["forest", "dark", "LR"],
    ["default", "light", "TD"],
  ])("lifts the stroke's ink to a quiet ratio on the fill (%s on %s, %s)", (theme, background, dir) => {
    const source = `flowchart ${dir}\n  A((Circle)) ~~~ B{Rhombus} ~~~ C(((Double circle)))`;
    const marks = marksOf(renderThemed(source, { width: 90, background, borders: "padless" }, theme));
    expect(marks.length).toBeGreaterThan(0);
    for (const { fg, bg } of marks) {
      expect(fg).toBeDefined();
      expect(bg).toBeDefined();
      if (fg !== undefined && bg !== undefined) expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(QUIET_RATIO - 0.05);
    }
  });
});
