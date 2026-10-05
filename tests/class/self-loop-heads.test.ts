import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const rowsOf = (source: string): string[] => render(source, { width: 80 }).split("\n");

// A self relation's mark points INTO the class at both ends, as the same mark on a relation between two classes does.
describe("a class self relation's marks", () => {
  it("points the inheritance head into the box on the right wall (TB)", () => {
    expect(rowsOf("classDiagram\n  direction TB\n  A <|-- A : self\n").some((row) => /│◁┐/u.test(row))).toBe(true);
  });

  it("points the inheritance head into the box on the left wall (LR)", () => {
    expect(rowsOf("classDiagram\n  direction LR\n  A <|-- A : self\n  A <-- B\n").some((row) => /┌▷│/u.test(row))).toBe(true);
  });
});

// Two self relations on one class looping left move the class to the far end of its room once, not once per loop.
describe("a class with two self relations looping left", () => {
  it.each(["LR", "RL"])("keeps its gap to the neighbour (%s)", (direction) => {
    const rows = rowsOf(`classDiagram\n  direction ${direction}\n  A <|-- A : self\n  A <-- B\n  A "1" --> "*" A\n`);
    const lid = rows.find((row) => row.includes("┌──"));
    expect(lid).toMatch(/┐\s{2,}┌/u);
  });
});
