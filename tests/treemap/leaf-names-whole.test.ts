import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

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

describe("treemap leaf names", () => {
  it.each([80, 120, undefined])("writes every leaf's name whole where the width holds it (width %s)", (width) => {
    const drawn = render(TREEMAP, width === undefined ? {} : { width });
    for (const name of ["Backend", "Frontend", "Infra", "PM", "Analytics", "UX", "Visual"]) expect(drawn).toContain(name);
    expect(drawn).not.toContain("…");
  });
});
