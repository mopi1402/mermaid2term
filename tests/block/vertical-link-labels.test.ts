import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

// A block grid has no direction: one column stacks the links down, two columns put them down the right or left track.
describe("a label beside a link down the grid", () => {
  it.each([
    ["one column", "columns 1\n  a b"],
    ["the right track", "columns 2\n  x a y b"],
  ])("stands whole past the canvas' right edge, %s", (_, grid) => {
    const drawn = render(`block-beta\n  ${grid}\n  a -- "a long label" --> b\n`, { width: 80 });
    expect(drawn).toMatch(/│a long label$/mu);
  });

  it.each([
    ["one column", "columns 1\n  a b c"],
    ["the left track", "columns 2\n  a x b y c z"],
  ])("routed down the left margin, takes free cells and leaves the next block's wall, %s", (_, grid) => {
    const drawn = render(`block-beta\n  ${grid}\n  a -- "abcdefghijkl" --> b\n  c -- "go" --> a\n`, { width: 80 });
    expect(drawn).toMatch(/^│ │ {4}b {5}│/mu);
    expect(drawn).toMatch(/^│go {2,}/mu);
    expect(drawn).toContain("│abcdefghijkl");
  });
});
