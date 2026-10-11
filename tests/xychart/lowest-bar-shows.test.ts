import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { NEWLINE } from "../../src/text/chars.js";
import { glyphsOf } from "../../src/text/width.js";
import { withConfig } from "../support/frontmatter.js";

// Every glyph a bar's cell may take, across or up.
const BAR = /[▏▎▍▌▋▊▉█▁▂▃▄▅▆▇]/u;

const drawn = (orientation: string): string[][] =>
  render(withConfig({ xyChart: { chartOrientation: orientation } }, "xychart-beta\n    x-axis [draw, router, layers, canvas]\n    bar [690, 584, 485, 326]\n"), { width: 80 })
    .split(NEWLINE)
    .map(glyphsOf);

// mermaid's linear axis pads its range by half a label at each end, so the bar of the smallest value keeps that length.
describe("an xychart's bar at the bottom of an unwritten value range", () => {
  it("draws the smallest value's bar across from the axis (horizontal)", () => {
    const rows = drawn("horizontal");
    const row = rows.find((cells) => cells.join("").startsWith("canvas"));
    expect(row).toBeDefined();
    const axis = row?.indexOf("│") ?? -1;
    expect(row?.[axis + 1]).toMatch(BAR);
  });

  it("draws the smallest value's bar up from the axis (vertical)", () => {
    const rows = drawn("vertical");
    const axis = rows.findIndex((cells) => cells.includes("└"));
    const col = rows[axis + 1].join("").indexOf("canvas") + Math.floor("canvas".length / 2);
    expect(rows[axis - 1][col]).toMatch(BAR);
  });
});
