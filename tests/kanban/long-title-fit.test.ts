import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { displayWidth, truncateToWidth, truncatedWidths } from "../../src/text/width.js";
import { TWO_PANES, widest } from "../support/drawn.js";

// Each of these took from seconds to minutes when the fit refolded every title at every cell it narrowed.
const LONG_TITLES = {
  "a title of many words": "kanban\n" + "a ".repeat(3000),
  "a title of one long word": "kanban\n" + "a".repeat(20000),
  "a title of wide words": "kanban\n" + "漢字 ".repeat(2000),
};
// Fifty columns cannot narrow under the budget: the board stays as narrow as its columns go.
const MANY_COLUMNS = "kanban\n" + Array.from({ length: 50 }, (_, i) => `  k${i}[${"x ".repeat(200)}]`).join("\n");
const BOUND_MS = 2000;

describe("kanban fits a long title to the width quickly", () => {
  it.each(TWO_PANES)("draws every long title within the budget of %i columns in well under its old time", (width) => {
    for (const source of Object.values(LONG_TITLES)) {
      const started = performance.now();
      const out = render(source, { width });
      expect(performance.now() - started).toBeLessThan(BOUND_MS);
      expect(widest(out)).toBeLessThanOrEqual(width);
    }
    const started = performance.now();
    render(MANY_COLUMNS, { width });
    expect(performance.now() - started).toBeLessThan(BOUND_MS);
  });

  it("measures a cut text as wide as the text cut", () => {
    for (const text of ["abcdef", "漢字漢字漢字", "a漢b字c", "x\ufe0fy", "😀😀😀", "é", ""]) {
      const cut = truncatedWidths(text);
      for (let width = 0; width <= 14; width++) expect(cut(width)).toBe(displayWidth(truncateToWidth(text, width)));
    }
  });
});
