import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { headOf, rowsOf, TWO_PANES, widest } from "../support/drawn.js";

const LONG = "A rather long diagram title that cannot fit on a single forty column line at all";
const source = (direction: string, title: string): string =>
  `timeline ${direction}\n title ${title}\n 2002 : LinkedIn\n 2004 : Facebook\n 2005 : YouTube`;

// mermaid centres a timeline's title over the drawing; past the budget it folds on words as every title does.
describe.each(["LR", "TD"])("a %s timeline's title", (direction) => {
  it.each(TWO_PANES)("folds on words inside width %i, every word kept", (width) => {
    const drawn = render(source(direction, LONG), { width });
    expect(widest(drawn)).toBeLessThanOrEqual(width);
    expect(headOf(drawn).map((row) => row.trim()).join(" ")).toBe(LONG);
  });

  it.each(TWO_PANES)("stands centred over the drawing at width %i", (width) => {
    const drawn = render(source(direction, "Tl"), { width });
    const [title] = rowsOf(drawn);
    const body = Math.max(...rowsOf(drawn).slice(2).map((row) => row.trimEnd().length));
    expect(title.trim()).toBe("Tl");
    expect(title.indexOf("Tl")).toBe(Math.floor((body - 2) / 2));
  });
});
