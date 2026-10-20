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

  it.each([
    ["a column count", "block-beta\ncolumns 999999999\na b c\n"],
    ["a space's span", "block-beta\nspace:999999999\n"],
    ["a block's span", "block-beta\na:999999999 b\n"],
    ["a padding", "---\nconfig:\n  block:\n    padding: 999999999\n---\nblock-beta\na b\n"],
  ])("draws %s of a billion in a bounded canvas, where it used to exhaust the heap", (_, source) => {
    const { drawn, ms } = timed(source);
    expect(ms).toBeLessThan(2000);
    expect(drawn.length).toBeLessThan(20_000);
  });

  it("frames a composite as wide as the blocks it holds, never the empty columns it declares, as mermaid does", () => {
    const drawn = render("block-beta\nblock:g\ncolumns 4\na b\nend\nc", { width: 200 });
    const lid = drawn.split("\n")[0];
    expect(lid.slice(0, lid.indexOf("┐") + 1)).toBe(`┌${"─".repeat(32)}┐`);
  });
});
