import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

// Across the page a run leaving the looped wall over the loop's return was drawn through its way down: `├──│───`.
describe("a run leaving a looped box never cuts its lone loop", () => {
  it.each(["a rather long loop label", "lp"])("label %s", (label) => {
    const source = `flowchart LR\n  A --> B\n  A --> C\n  A -->|${label}| A\n`;
    for (const width of [40, 80, 120]) {
      for (const borders of ["default", "padless", "borderless"] as const) {
        const drawn = render(source, { width, borders });
        expect(drawn, drawn).not.toMatch(/─│[─╭╮╯╰]/);
        expect(drawn, drawn).toContain(label);
      }
    }
  });
});
