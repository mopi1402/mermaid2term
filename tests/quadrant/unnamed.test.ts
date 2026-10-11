import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

describe("a quadrant no `quadrant-N` names", () => {
  it("writes no placeholder in it, as mermaid's `quadrant1Text` defaults to nothing", () => {
    const drawn = render("quadrantChart\n    A: [0.2, 0.8]\n", { width: 60 });
    expect(drawn).not.toMatch(/Q[1-4]/u);
    expect(drawn).toContain("A");
  });

  it("keeps the name of a quadrant the source names, the others left empty", () => {
    const drawn = render("quadrantChart\n    quadrant-1 Expand\n    A: [0.2, 0.8]\n", { width: 60 });
    expect(drawn).toContain("Expand");
    expect(drawn).not.toMatch(/Q[2-4]/u);
  });
});
