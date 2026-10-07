// Under padless a destroyed box's wall rides the inner edge of its cell, so the cross of the message destroying it
// stood a cell of air away (`─x▕ Carl ▏`). It is seated on the wall instead, as on a created box.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const lineOf = (drawing: string, label: string): string => {
  const rows = drawing.split("\n");
  return rows[rows.findIndex((row) => row.includes(label)) + 1] ?? "";
};

const destroying = (first: string, second: string, arrow: string): string =>
  `sequenceDiagram\n  participant ${first}\n  participant ${second}\n  Alice->>Carl: hi\n  destroy Carl\n  Alice${arrow}Carl: too many\n`;

describe("a destroyed box under padless", () => {
  for (const width of [40, 80, 120]) {
    it(`takes the cross on its wall from the left, at ${width}`, () => {
      const drawn = render(destroying("Alice", "Carl", "-x"), { borders: "padless", width });
      expect(lineOf(drawn, "too many")).toMatch(/─x {2}Carl {2}▏$/u);
    });

    it(`takes the cross on its wall from the right, at ${width}`, () => {
      const drawn = render(destroying("Carl", "Alice", "-x"), { borders: "padless", width });
      expect(lineOf(drawn, "too many")).toMatch(/^▕ {2}Carl {2}x─/u);
    });

    it(`takes a head against its wall, at ${width}`, () => {
      const drawn = render(destroying("Alice", "Carl", "->>"), { borders: "padless", width });
      expect(lineOf(drawn, "too many")).toMatch(/─⏵▏ Carl {2}▏$/u);
    });
  }

  it("keeps its wall whole when it sends the message itself", () => {
    const drawn = render("sequenceDiagram\n  participant Alice\n  participant Carl\n  Alice->>Carl: hi\n  destroy Carl\n  Carl-xAlice: bye\n", { borders: "padless" });
    expect(lineOf(drawn, "bye")).toMatch(/─▕ {2}Carl {2}▏$/u);
  });
});
