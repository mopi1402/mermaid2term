import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { THREE_PANES } from "../support/drawn.js";

// Two links passing each other: the one going down keeps the cell, the one across is cut.
const CROSSED = /[─━]┼[─━]/u;
const CUT = /─│[─╮╯]/u;

const CLASS = "classDiagram\n  direction TB\n  A<|--B\n  A<|--C\n  A<|--D\n  B<|--E\n  D<|--E\n  C<|--F\n  B<|--F\n";
const ER_LINKS = "  A ||--o{ B : r\n  A ||--o{ C : r\n  A ||--o{ D : r\n  B ||--o{ E : r\n";
const ER: Record<string, string> = {
  TB: `erDiagram\n${ER_LINKS}  D ||--o{ E : r\n  C ||--o{ F : r\n  B ||--o{ F : r\n  A ||--o{ F : s\n`,
  LR: `erDiagram\n  direction LR\n${ER_LINKS}  C ||--o{ F : r\n  A ||--o{ F : r\n`,
};

describe("two class relations that cross are cut, never a crossing", () => {
  it.each(["TB", "LR"])("the diamond of inheritances, %s", (direction) => {
    for (const width of THREE_PANES) {
      const drawing = render(CLASS.replace("direction TB", `direction ${direction}`), { width });
      expect(drawing).not.toMatch(CROSSED);
      if (direction === "TB") expect(drawing).toMatch(CUT);
    }
  });
});

describe("two ER relations that cross are cut, never a crossing", () => {
  it.each(["TB", "LR"])("the six entities, %s", (direction) => {
    for (const width of THREE_PANES) {
      const drawing = render(ER[direction], { width });
      expect(drawing).not.toMatch(CROSSED);
      expect(drawing).toMatch(CUT);
    }
  });
});
