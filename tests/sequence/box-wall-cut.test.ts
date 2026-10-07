import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

const SOURCE = `sequenceDiagram
box Aqua Team
participant A
participant B
end
participant C
A->>C: hello
C-->>A: back
B-)C: async`;

describe("a message crossing a box's wall keeps its cell, the wall cut under it", () => {
  it.each(TWO_PANES)("at width %i", (width) => {
    const rows = render(SOURCE, { width }).split("\n");
    expect(rows.filter((row) => /[╫╪╬┼]/u.test(row))).toEqual([]);
    const wall = rows[0].indexOf("╗");
    for (const [label, run] of [["hello", "─"], ["back", "┄"], ["async", "─"]] as const) {
      const at = rows.findIndex((row) => row.includes(label));
      expect([label, rows[at + 1][wall]]).toEqual([label, run]);
    }
  });
});
