import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

// A root with hundreds of children: each way to deal them round it used to be drawn in full, about 25 per child.
const siblings = (count: number, label: string): string => ["mindmap", "root", ...Array.from({ length: count }, () => `  ${label}`)].join("\n");

const timed = (source: string, width: number): { ms: number; rows: number } => {
  const start = performance.now();
  const out = render(source, { width });
  return { ms: performance.now() - start, rows: out.split("\n").length };
};

describe("mindmap with many siblings", () => {
  it("deals 200 short children round the root in well under the old 7 s", () => {
    const { ms, rows } = timed(siblings(200, "a"), 80);
    expect(ms).toBeLessThan(2000);
    expect(rows).toBe(197);
  });

  it("deals 200 wide children, too wide for both sides, in well under the old 46 s", () => {
    const { ms, rows } = timed(siblings(200, "abcdefghij".repeat(4)), 80);
    expect(ms).toBeLessThan(2000);
    expect(rows).toBe(399);
  });
});
