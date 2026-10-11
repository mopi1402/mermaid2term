import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";

const source = `pie title Languages
    "Python" : 40
    "JavaScript" : 30
    "Go" : 20
    "Rust" : 10
    "C" : 5
    "Zig" : 5
`;

const inksOf = (row: string): string[] => [...row.matchAll(/\x1b\[([0-9;]*)m█/gu)].map((m) => m[1]);

// Every slice is the same full block, so a colourless theme tells them apart by grey alone, one grey per slice.
describe("a pie under mono", () => {
  it.each([["dark", 60], ["dark", 100], ["light", 60], ["light", 100]] as const)("gives every slice its own grey (%s, width %i)", (background, width) => {
    const rows = renderThemed(source, { width, background }, "mono").split("\n");
    const legend = rows.filter((row) => row.includes("┃")).map((row) => inksOf(row)[0]);
    expect(new Set(legend).size).toBe(6);
    expect(legend.every((codes) => /38;2;/u.test(codes ?? ""))).toBe(true);
  });
});
