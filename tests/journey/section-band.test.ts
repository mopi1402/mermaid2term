import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

const source = "journey\n  section A very long section name\n    T: 5: Me\n  section B\n    U: 3: Me\n";

// A section's name stands over its own tasks, folded or widening them, and never runs into the next section's header.
describe("journey section band", () => {
  it.each(TWO_PANES)("keeps every word of the name inside its header at width %i", (width) => {
    const rows = render(source, { width }).split("\n");
    const header = rows[0];
    const close = header.indexOf("╮");
    const next = header.indexOf("╭", close);
    expect(header).toContain("─ B ─");
    const names = rows.slice(0, rows.findIndex((row) => row.includes("●")));
    const words = names.join(" ").split(/[\s╭╮─]+/).filter((word) => word !== "" && word !== "B");
    expect(words).toEqual(["A", "very", "long", "section", "name"]);
    for (const row of names) {
      const last = Math.max(...["A", "very", "long", "section", "name"].map((word) => (row.includes(word) ? row.indexOf(word) + word.length : -1)));
      expect(last).toBeLessThanOrEqual(close);
      expect(last).toBeLessThan(next);
    }
  });

  it.each(TWO_PANES)("sits the tasks right under the name at width %i", (width) => {
    const rows = render(source, { width }).split("\n");
    const tops = rows.findIndex((row) => row.includes("●"));
    expect(rows[tops]).toMatch(/^ ╭●/);
  });
});
