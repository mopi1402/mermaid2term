import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const LR = "classDiagram\n  direction LR\n  classA --|> classB : Inheritance\n  classC --* classD : Composition\n";

const GALLERY = fs.readFileSync("fixtures/class/relationship-types.mmd", "utf8");

const longestBlankRun = (drawn: string): number => {
  let longest = 0;
  let run = 0;
  for (const row of drawn.split("\n")) {
    run = row.trim() === "" ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
};

// Three blank rows down the page read as the four columns between two families side by side.
describe("class families stacked down the page", () => {
  it("leave three blank rows between them (LR)", () => {
    expect(longestBlankRun(render(LR, { width: 40 }))).toBe(3);
  });

  it("leave three blank rows between them (no direction)", () => {
    expect(longestBlankRun(render(GALLERY, { width: 80 }))).toBe(3);
  });
});
