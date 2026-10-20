import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { nested, workOf } from "../support/work.js";

// Each subgraph grounded its whole interior again over the ones nested in it, and poured its grid cells into a set of
// its own: the work grew with the cube of the depth, 250 levels taking 30 s and 2.8 GB. The drawing itself grows with
// the square, and so must the work: doubling the depth multiplies it by about 4, where the cube made it 8.
describe("nested subgraphs cost the square of their depth", () => {
  it.each(["TD", "LR"])("%s", (direction) => {
    const at = (depth: number) =>
      workOf(() => render(nested(`graph ${direction}`, (i) => `subgraph S${i}`, "A-->B", "end", depth), { width: 80 }));
    const shallow = at(30);
    const deep = at(60);
    expect(deep.styles / shallow.styles).toBeLessThan(5.5);
    expect(deep.entries / shallow.entries).toBeLessThan(5.5);
  });
});
