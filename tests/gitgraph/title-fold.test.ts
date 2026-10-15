import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { headOf, TWO_PANES, widest } from "../support/drawn.js";

const LONG = "A rather long diagram title that cannot fit on a single forty column line at all, nor on eighty however it is put";
const source = (direction: string): string =>
  `gitGraph ${direction}:\n title ${LONG}\n commit\n branch dev\n commit\n checkout main\n merge dev`;

describe.each(["LR", "TB"])("a %s gitgraph's body title wider than its budget", (direction) => {
  it.each(TWO_PANES)("folds on words inside width %i, every word kept", (width) => {
    const drawn = render(source(direction), { width });
    expect(widest(drawn)).toBeLessThanOrEqual(width);
    expect(headOf(drawn).map((row) => row.trim()).join(" ")).toBe(LONG);
  });
});
