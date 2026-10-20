import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { NEWLINE } from "../../src/text/chars.js";
import { withConfig } from "../support/frontmatter.js";

const ORIENTATIONS = ["vertical", "horizontal"] as const;
// Well under what the drawings below took before their values were held to the canvas.
const BOUND_MS = 2000;
const COMPAT = "  m2t_charset: compat\n";

const timed = (source: string): { out: string; ms: number } => {
  const start = performance.now();
  const out = render(source, { width: 80 });
  return { out, ms: performance.now() - start };
};

const chart = (orientation: string, body: string, config = ""): string => withConfig(`  xyChart:\n    chartOrientation: ${orientation}\n${config}`, `xychart-beta\n${body}`);

describe("an xychart's values far past its value axis", () => {
  it.each(ORIENTATIONS)("draws a bar far over the axis's top as fast and as tall as one at the top (%s)", (orientation) => {
    const { out, ms } = timed(chart(orientation, "    y-axis 0 --> 1\n    bar [10000000]\n"));
    expect(ms).toBeLessThan(BOUND_MS);
    expect(out.split(NEWLINE).length).toBe(render(chart(orientation, "    y-axis 0 --> 1\n    bar [1]\n"), { width: 80 }).split(NEWLINE).length);
  });

  it.each(ORIENTATIONS)("draws a stroked line to a point far over the axis's top within the bound (%s)", (orientation) => {
    const { out, ms } = timed(chart(orientation, '    y-axis 0 --> 1\n    line [10000000 "far", 0 "near"]\n', COMPAT));
    expect(ms).toBeLessThan(BOUND_MS);
    expect(Math.max(...out.split(NEWLINE).map((row) => row.length))).toBeLessThan(200);
  });

  it.each(ORIENTATIONS)("leaves out a value too large to hold as a number, the others drawn (%s)", (orientation) => {
    const { out, ms } = timed(chart(orientation, "    line [1e999, 1]\n"));
    expect(ms).toBeLessThan(BOUND_MS);
    expect(out).toBe(render(chart(orientation, "    line [1]\n"), { width: 80 }));
  });

  it.each(ORIENTATIONS)("draws nothing for values spread wider than a number holds (%s)", (orientation) => {
    const { out, ms } = timed(chart(orientation, "    line [1e308, -1e308]\n"));
    expect(ms).toBeLessThan(BOUND_MS);
    expect(out).toBe("");
  });

  it.each(ORIENTATIONS)("reads a value range too wide to hold as a number as unwritten (%s)", (orientation) => {
    const huge = `1${"0".repeat(400)}`;
    const { out, ms } = timed(chart(orientation, `    y-axis -${huge} --> ${huge}\n    bar [5, 6]\n`));
    expect(ms).toBeLessThan(BOUND_MS);
    expect(out).toBe(render(chart(orientation, "    bar [5, 6]\n"), { width: 80 }));
  });
});
