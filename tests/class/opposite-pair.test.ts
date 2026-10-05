import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

// `C --> D` and `D --> C` are two relations, not one `<-->`: each keeps its own run and its own head, as flowchart draws them.
describe("two class relations running opposite ways between one pair", () => {
  it("draws both runs down the page (TB)", () => {
    const drawn = render("classDiagram\n  direction TB\n  C --> D\n  D --> C\n", { width: 80 });
    expect(drawn).toContain("⏷");
    expect(drawn).toContain("⏶");
    expect(drawn.split("\n").some((row) => /│ ⏶|⏶ │/u.test(row))).toBe(true);
  });

  it("draws both runs across the page (LR)", () => {
    const drawn = render("classDiagram\n  direction LR\n  C --> D\n  D --> C\n", { width: 80 });
    expect(drawn).toContain("─⏵");
    expect(drawn).toContain("⏴─");
  });
});
