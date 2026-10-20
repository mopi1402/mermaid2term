import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { nested, workOf } from "../support/work.js";

// Each composite laid its body's ground again over the ones nested in it, and poured its grid cells into a set of
// its own: 200 levels took 74 s. The drawing grows with the square of the depth, and so must the work.
describe("nested composite states cost the square of their depth", () => {
  it.each(["TB", "LR"])("%s", (direction) => {
    const at = (depth: number) =>
      workOf(() => render(nested(`stateDiagram-v2\ndirection ${direction}`, (i) => `state S${i} {`, "A-->B", "}", depth), { width: 80 }));
    const shallow = at(30);
    const deep = at(60);
    expect(deep.styles / shallow.styles).toBeLessThan(5.5);
    expect(deep.entries / shallow.entries).toBeLessThan(5.5);
  });
});
