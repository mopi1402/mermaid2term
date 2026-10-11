import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { displayWidth, truncateToWidth } from "../../src/text/width.js";
import { TWO_PANES } from "../support/drawn.js";

const LONG = "An extraordinarily long slice name that no pie legend of eighty columns could ever hold on one row";

describe("a cut text ends on one ellipsis across every kind", () => {
  it("measures the ellipsis one cell", () => {
    expect(displayWidth("…")).toBe(1);
    expect(truncateToWidth("abcdef", 4)).toBe("abc…");
  });

  it.each(TWO_PANES)("ends a pie label cut to the legend on … at width %i", (width) => {
    const drawing = render(`pie\n  "${LONG}" : 3\n  "B" : 1\n`, { width });
    const row = drawing.split("\n").find((line) => line.includes("An extra"));
    expect(row).toContain("…");
  });
});
