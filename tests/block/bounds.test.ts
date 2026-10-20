import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";

const timed = (source: string): { drawn: string; ms: number } => {
  const start = performance.now();
  const drawn = render(source, { width: 80 });
  return { drawn, ms: performance.now() - start };
};

describe("a block diagram stays bounded in time and memory whatever its source asks", () => {
  it("sizes thirty nested blocks once each, where every level used to size its subtree twice", () => {
    const depth = 30;
    const opens = Array.from({ length: depth }, (_, i) => `block:b${i}`);
    const source = ["block-beta", ...opens, "a", ...opens.map(() => "end")].join("\n");
    const { drawn, ms } = timed(source);
    expect(drawn).toContain("a");
    expect(ms).toBeLessThan(2000);
  });
});
