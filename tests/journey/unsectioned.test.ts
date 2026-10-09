import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const TASKS = "    Wake up: 2\n    Coffee: 4\n";

describe("a journey whose tasks stand under no `section`", () => {
  for (const borders of ["default", "padless", "borderless"] as const) {
    it(`draws no header over them, its first row the tasks' own lid (${borders})`, () => {
      const rows = render(`journey\n${TASKS}`, { width: 60, borders }).split("\n");
      expect(rows[1]).toContain("Wake up");
      expect(rows[1]).toContain("Coffee");
    });
  }

  it("keeps the header of a named section, its name on the first row", () => {
    const rows = render(`journey\n    section Morning\n${TASKS}`, { width: 60 }).split("\n");
    expect(rows[0]).toContain("Morning");
    expect(rows.findIndex((row) => row.includes("Wake up"))).toBeGreaterThan(1);
  });
});
