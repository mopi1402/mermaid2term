// mermaid's neo and redux themes state no `rowOdd` nor `rowEven`: erBox fills the attribute rows with nothing, and
// the entity's own fill shows through every one. The themes that state them still stripe the rows by turns.

import { describe, expect, it } from "vitest";

import { renderThemedText } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

const GROUND_RE = /on (#[0-9a-f]{6})/iu;

const er = (direction: string): string => `erDiagram
    direction ${direction}
    ORDER {
        string id
        string status
        int total
        string coupon
    }
    CUSTOMER ||--o{ ORDER : places`;

const ATTRIBUTES = ["id", "status", "total", "coupon"];

// The grounds ORDER's attribute names are written on, read on their own cells and nothing else on the row.
const rowGrounds = (source: string, theme: string, side: "light" | "dark", width: number): Set<string> => {
  const grounds = new Set<string>();
  for (const row of renderThemedText(source, { width, background: side }, theme).rows) {
    const line = row.map((cell) => cell.ch).join("");
    for (const name of ATTRIBUTES) {
      const at = line.search(new RegExp(`\\b${name}\\b`, "u"));
      if (at < 0) continue;
      const ground = GROUND_RE.exec(row[at]?.style ?? "")?.[1];
      if (ground !== undefined) grounds.add(ground.toLowerCase());
    }
  }
  return grounds;
};

describe.each(TWO_PANES)("an entity's attribute rows, at width %i", (width) => {
  describe.each(["TB", "LR"])("drawn %s", (direction) => {
    it.each([
      ["neo", "light"],
      ["neo", "dark"],
      ["redux", "light"],
      ["redux", "dark"],
      ["redux-color", "light"],
    ] as const)("lie on one ground under %s, %s", (theme, side) => {
      expect(rowGrounds(er(direction), theme, side, width).size).toBe(1);
    });

    it("are striped by turns under default", () => {
      expect(rowGrounds(er(direction), "default", "light", width).size).toBe(2);
    });
  });
});
