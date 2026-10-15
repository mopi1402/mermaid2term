import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

// A link leaves a block through a tee cut into its wall, as a flowchart edge leaves its box; its head stops beside it.
describe("a block link", () => {
  it.each([80, 40])("cuts a tee into the wall it leaves, across and down (width %i)", (width) => {
    const drawing = render("block-beta\n  columns 3\n  a space b\n  c\n  a --> b\n  a --> c\n", { width });
    expect(drawing).toMatch(/│\s+a\s+├─+⏵│\s+b\s+│/u);
    expect(drawing).toMatch(/└─*┬─*┘/u);
  });

  it.each([80, 40])("cuts a tee at both ends of a link without heads (width %i)", (width) => {
    const drawing = render("block-beta\n  columns 3\n  a space b\n  a --- b\n", { width });
    expect(drawing).toMatch(/│\s+a\s+├─+┤\s+b\s+│/u);
  });

  it.each([80, 40])("keeps its head beside the wall it reaches (width %i)", (width) => {
    const drawing = render("block-beta\n  columns 3\n  a space b\n  a <--> b\n", { width });
    expect(drawing).toMatch(/│\s+a\s+│⏴─+⏵│\s+b\s+│/u);
  });
});
