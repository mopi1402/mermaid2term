import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const SOURCE = "sequenceDiagram\n  box Tech\n  participant A\n  participant B\n  end\n  A->>B: hi\n";

// A `box` leaves one row of its walls alone between the lifelines' end and its floor.
describe("a sequence box's floor", () => {
  it.each(["default", "padless"] as const)("stands one blank row under the lifelines (%s)", (borders) => {
    const rows = render(SOURCE, { width: 80, borders }).split("\n");
    const floor = rows.length - 1 - [...rows].reverse().findIndex((row) => /[╚▔]/u.test(row));
    expect(rows[floor - 1]?.replace(/[║▏▕]/gu, "").trim()).toBe("");
    expect(rows[floor - 2]).toMatch(/[│┃]/u);
  });
});
