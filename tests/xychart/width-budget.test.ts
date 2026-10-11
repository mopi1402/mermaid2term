import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { widest } from "../support/drawn.js";
import { withConfig } from "../support/frontmatter.js";

const ORIENTATIONS = ["vertical", "horizontal"];

const chart = (orientation: string, body: string): string =>
  withConfig({ xyChart: { chartOrientation: orientation } }, `xychart-beta\n${body}`);

const MONTHS =
  '    title "Monthly signups"\n    x-axis [January, February, March, April, May, June, July, August, September, October]\n    y-axis "Signups" 0 --> 400\n    bar [120, 240, 310, 380, 200, 150, 90, 300, 260, 180]\n';

describe("xychart under a width budget", () => {
  it.each(ORIENTATIONS)("fits every line within 40 columns (%s)", (orientation) => {
    expect(widest(render(chart(orientation, MONTHS), { width: 40 }))).toBeLessThanOrEqual(40);
  });

  it.each(ORIENTATIONS)("fits every line within 60 columns (%s)", (orientation) => {
    expect(widest(render(chart(orientation, MONTHS), { width: 60 }))).toBeLessThanOrEqual(60);
  });

  it.each(ORIENTATIONS)("keeps a chart that already fits as it is drawn unbounded (%s)", (orientation) => {
    const small = "    x-axis [a, b, c]\n    bar [5, 6, 7]\n";
    expect(render(chart(orientation, small), { width: 80 })).toBe(render(chart(orientation, small)));
  });
});
