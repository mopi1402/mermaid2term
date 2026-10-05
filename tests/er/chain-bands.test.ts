// A lone ER chain too wide for the page folds into bands the way the graph's `foldChain` does, instead of turning
// down into one tall column.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const CHAIN = `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE : has
  LINE }|--|| PRODUCT : refs
  PRODUCT }|--|| VENDOR : from
  VENDOR ||--|| COUNTRY : in`;

const widest = (drawn: string): number => Math.max(...drawn.split("\n").map((line) => [...line].length));
const rowWith = (drawn: string, name: string): number => drawn.split("\n").findIndex((line) => line.includes(name));

describe("ER chain folds into bands", () => {
  for (const autoRotate of [true, false]) {
    it(`fits 70 columns with two entities on a row, autoRotate ${autoRotate}`, () => {
      const drawn = render(CHAIN, { width: 70, autoRotate });
      expect(widest(drawn)).toBeLessThanOrEqual(70);
      expect(rowWith(drawn, "CUSTOMER")).toBe(rowWith(drawn, "ORDER"));
      expect(drawn.split("\n").length).toBeLessThan(20);
    });
  }

  it("keeps one row when the page holds it", () => {
    const drawn = render(CHAIN, { width: 120 });
    expect(rowWith(drawn, "CUSTOMER")).toBe(rowWith(drawn, "COUNTRY"));
  });
});
