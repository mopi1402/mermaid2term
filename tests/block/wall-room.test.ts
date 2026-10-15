import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";

const BLOCKS = readFileSync("fixtures/block/shapes.mmd", "utf8");
const GRID = readFileSync("fixtures/block/basic-grid.mmd", "utf8");

// Squeezed to its narrowest padding, a block once gave its words the columns its walls and rails stand on.
describe("a block keeps room for its walls beside its words", () => {
  it.each([30, 40, 80])("keeps the subroutine's rails and every wall whole, at width %i", (width) => {
    const drawn = render(BLOCKS, { width });
    expect(drawn).toMatch(/││ ?subroutine ?││/u);
    expect(render(GRID, { width })).toMatch(/│ ?API Gateway ?│/u);
  });
});
