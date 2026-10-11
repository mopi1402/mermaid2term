import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { headOf, TWO_PANES, widest } from "../support/drawn.js";

const TITLE = "A rather long diagram title that cannot fit on a single forty column line at all";
const LABEL = "A very long label for the dogs of the household here";
const SOURCE = `pie showData title ${TITLE}\n "${LABEL}" : 386\n "Cats" : 85\n "Rats" : 15`;

describe("a pie under a width budget", () => {
  it.each(TWO_PANES)("holds width %i, its title folded on words and every word kept", (width) => {
    const drawn = render(SOURCE, { width });
    expect(widest(drawn)).toBeLessThanOrEqual(width);
    expect(headOf(drawn).map((row) => row.trim()).join(" ")).toBe(TITLE);
  });

  it("centres each folded title row on one axis", () => {
    const centres = headOf(render(SOURCE, { width: 40 })).map((row) => row.search(/\S/u) * 2 + row.trim().length);
    for (const centre of centres) expect(Math.abs(centre - centres[0])).toBeLessThanOrEqual(1);
  });

  it("shrinks the bar before it cuts a label, and keeps the whole label where the budget holds it", () => {
    expect(render(SOURCE, { width: 80 })).toContain(LABEL);
    const narrow = render(SOURCE, { width: 40 });
    expect(narrow).not.toContain(LABEL);
    expect(narrow).toContain("A very long");
  });
});
