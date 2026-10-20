import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";

const BOUND_MS = 2000;

const timed = (source: string): { out: string; ms: number } => {
  const start = performance.now();
  const out = render(source, { width: 80 });
  return { out, ms: performance.now() - start };
};

describe("a gantt spanning millions of days draws in a bounded time, whatever the span", () => {
  const cases: Record<string, string> = {
    "a 99,999,999-day task": "gantt\ndateFormat YYYY-MM-DD\nsection S\nt :a, 2020-01-01, 99999999d",
    "a timestamp range to the end of time": "gantt\ndateFormat x\nsection S\nt :a, 0, 8640000000000000",
    "the years 1 to 9999": "gantt\ndateFormat YYYY-MM-DD\nsection S\nt :a, 0001-01-01, 9999-12-31",
    "a huge task with weekends excluded": "gantt\ndateFormat YYYY-MM-DD\nexcludes weekends\nsection S\nt :a, 2020-01-01, 99999999d",
    "a huge task with one date excluded": "gantt\ndateFormat YYYY-MM-DD\nexcludes 2020-01-05\nsection S\nt :a, 2020-01-01, 99999999d",
    "many long tasks with one date excluded": `gantt\ndateFormat YYYY-MM-DD\nexcludes 2020-01-05\nsection S\n${Array.from({ length: 300 }, (_, i) => `t${i} :a${i}, 2020-01-01, 100000d`).join("\n")}`,
  };
  for (const [name, source] of Object.entries(cases)) {
    it(`draws ${name} in under ${BOUND_MS} ms`, () => {
      const { out, ms } = timed(source);
      expect(out.length).toBeGreaterThan(0);
      expect(ms).toBeLessThan(BOUND_MS);
    }, 60_000);
  }

  it("still measures the widest date of a span far longer than its sampled windows", () => {
    const { out } = timed("gantt\ndateFormat YYYY-MM-DD\naxisFormat %B\nsection S\nt :a, 0001-01-01, 9999-12-31");
    expect(out).toContain("January");
  });
});
