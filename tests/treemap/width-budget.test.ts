import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { widest } from "../support/drawn.js";

const TREEMAP = `treemap-beta
    "Engineering"
        "Backend": 45
        "Frontend": 40
        "Infra": 35
    "Product"
        "PM": 20
        "Analytics": 10
    "Design"
        "UX": 15
        "Visual": 10
`;

describe("treemap under a width budget", () => {
  it.each([40, 60])("scales its cells to fit within %i columns", (width) => {
    expect(widest(render(TREEMAP, { width }))).toBeLessThanOrEqual(width);
  });

  it("keeps a map that already fits as it is drawn unbounded", () => {
    expect(render(TREEMAP, { width: 120 })).toBe(render(TREEMAP));
  });
});
