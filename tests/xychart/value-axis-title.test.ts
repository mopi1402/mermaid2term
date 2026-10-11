import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";

const NAME = "a very long value axis name that runs far past the chart";
const source = (orientation: string): string => `xychart-beta ${orientation}\n  x-axis [a, b, c]\n  y-axis "${NAME}"\n  bar [1, 2, 3]\n`;
const words = (drawn: string): string => drawn.split("\n").slice(0, 3).join(" ").replace(/[↑→]/gu, "").replace(/\s+/gu, " ");

describe("the value axis's name is never cut: whole with no budget, folded on words within one, as quadrant's", () => {
  it.each(["", "horizontal"])("orientation %s", (orientation) => {
    expect(render(source(orientation), {}).split("\n")[0]).toContain(NAME);
    const folded = render(source(orientation), { width: 40 });
    expect(words(folded)).toContain(NAME);
    expect(Math.max(...folded.split("\n").map((line) => displayWidth(line.trimEnd())))).toBeLessThanOrEqual(40);
  });
});
