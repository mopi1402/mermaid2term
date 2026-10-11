import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { headOf, rowsOf, TWO_PANES, widest } from "../support/drawn.js";

const LONG = "A rather long diagram title that cannot fit on a single forty column line at all, nor on eighty however it is put";
const SOURCE = `quadrantChart
 title ${LONG}
 x-axis Very low effort for the whole engineering team --> Very high effort for the whole engineering team
 y-axis Low --> High
 A: [0.3, 0.6]`;

const footOf = (drawn: string): string[] => {
  const frameFoot = rowsOf(drawn).reduce((found, row, at) => (row.includes("└") ? at : found), 0);
  return rowsOf(drawn).slice(frameFoot + 2);
};

describe("a quadrant chart's title and x axis title under a width budget", () => {
  it.each(TWO_PANES)("hold width %i, folded on words, every word kept", (width) => {
    const drawn = render(SOURCE, { width });
    expect(widest(drawn)).toBeLessThanOrEqual(width);
    expect(headOf(drawn).map((row) => row.trim()).join(" ")).toBe(LONG);
    expect(footOf(drawn).map((row) => row.trim()).join(" ")).toBe(
      "Very low effort for the whole engineering team -> Very high effort for the whole engineering team"
    );
  });
});
