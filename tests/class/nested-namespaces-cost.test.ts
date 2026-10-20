import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { nested, workOf } from "../support/work.js";

// Each namespace grounded its whole interior again over the ones nested in it, the work growing with the cube of the
// depth. The drawing grows with the square, and so must the work.
describe("nested namespaces cost the square of their depth", () => {
  it.each(["TB", "LR"])("%s", (direction) => {
    const at = (depth: number) =>
      workOf(() => render(nested(`classDiagram\ndirection ${direction}`, (i) => `namespace N${i} {`, "class A", "}", depth), { width: 80 }));
    expect(at(60).styles / at(30).styles).toBeLessThan(5.5);
  });
});
