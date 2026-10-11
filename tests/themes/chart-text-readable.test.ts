// An xychart's and a quadrant chart's texts are weighed against the ground they are written on, as a pie's and a
// gantt's are: a theme ink that would vanish there is moved until it reads, at the same ratio.

import { describe, expect, it } from "vitest";

import { renderThemedText } from "../../src/index.js";
import { contrastRatio, PLAIN_RATIO } from "../../src/colour/contrast.js";
import { parseHex, type RGB } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";
import { TWO_PANES } from "../support/drawn.js";

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const HEX_RE = /#[0-9a-f]{6}/giu;

const inks = (source: string, width: number): ReadonlyMap<string, string> => {
  const found = new Map<string, string>();
  for (const cell of renderThemedText(source, { width, background: "light" }, "default").rows.flat()) {
    if (cell.owner !== undefined && cell.ch.trim() !== "") found.set(cell.owner, cell.style.toLowerCase());
  }
  return found;
};

// The first hex is the ink, the one after `on` the ground; with no `on` the text sits on the page.
const ratioOf = (style: string): number => {
  const [ink, ground] = [...style.matchAll(HEX_RE)].map((hex) => must(parseHex(hex[0])));
  return contrastRatio(must(ink, style), ground ?? WHITE);
};

const XY = `---
config:
  themeVariables:
    primaryTextColor: "#eeeeee"
---
xychart-beta
  title "Sales"
  x-axis [jan, feb, mar]
  y-axis "Revenue" 0 --> 10
  bar [3, 5, 7]`;

const QUADRANT = `---
config:
  themeVariables:
    quadrantTitleFill: "#f4f4f4"
    quadrantXAxisTextFill: "#eeeeee"
    quadrantYAxisTextFill: "#eeeeee"
    quadrant1TextFill: "#e8e8ff"
    quadrantPointTextFill: "#eeeeff"
---
quadrantChart
  title Reach
  x-axis Low --> High
  y-axis Low --> High
  quadrant-1 Expand
  quadrant-2 Promote
  Campaign A: [0.3, 0.6]`;

describe.each(TWO_PANES)("chart texts read on their ground, at width %i", (width) => {
  it("lifts an xychart's title and axis texts off a white page", () => {
    const styles = inks(XY, width);
    for (const owner of ["xychart_title", "xychart_x_label", "xychart_y_label"]) {
      expect(ratioOf(must(styles.get(owner), owner)), owner).toBeGreaterThanOrEqual(PLAIN_RATIO);
    }
  });

  it("lifts a quadrant chart's title, axis labels, quadrant names and point labels off their grounds", () => {
    const styles = inks(QUADRANT, width);
    for (const owner of ["quadrant_title", "quadrant_x_label", "quadrant_y_label", "quadrant_text_1", "quadrant_point_text_2"]) {
      expect(ratioOf(must(styles.get(owner), owner)), owner).toBeGreaterThanOrEqual(PLAIN_RATIO);
    }
  });
});
