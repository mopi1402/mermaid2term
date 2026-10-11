import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

describe("a quadrant chart left unbounded, framed and not a cross in open space", () => {
  const SOURCE =
    "quadrantChart\n    title Effort vs Impact\n    x-axis Low Effort --> High Effort\n" +
    "    quadrant-1 Do First\n    quadrant-2 Plan\n    quadrant-3 Delegate\n    quadrant-4 Eliminate\n" +
    "    Port the parser: [0.8, 0.9]\n    Rewrite the docs: [0.2, 0.3]\n";

  it("closes the plot on its four sides, the axes meeting the frame at a tee", () => {
    const rows = render(SOURCE, { width: 80 }).split("\n");
    expect(rows.find((row) => row.includes("┌")) ?? "").toMatch(/^\s*┌─+┬─+┐$/u);
    expect(rows.find((row) => row.includes("└")) ?? "").toMatch(/^\s*└─+┴─+┘$/u);
    expect(rows.find((row) => row.includes("┼")) ?? "").toMatch(/^\s*├─+┼─+┤$/u);
  });

  it("closes every row of the plot between the two sides", () => {
    const rows = render(SOURCE, { width: 80 }).split("\n");
    const first = rows.findIndex((row) => row.includes("┌"));
    const last = rows.findIndex((row) => row.includes("└"));
    expect(last - first).toBe(21);
    for (const row of rows.slice(first + 1, last)) {
      expect(row.trimEnd().endsWith("│") || row.trimEnd().endsWith("┤")).toBe(true);
    }
  });

  it("draws the frame and the axes each in its own border stroke, at one weight as mermaid's 2px and 1px are", () => {
    const written = withConfig({ themeVariables: { quadrantExternalBorderStrokeFill: '"#ff8800"', quadrantInternalBorderStrokeFill: '"#aaaa00"' } }, SOURCE);
    const painted = renderThemed(written, { width: 80, background: "light" }, "default");
    expect(painted).toContain("\u001b[38;2;255;136;0m┌");
    expect(painted).toMatch(/\u001b\[38;2;170;170;0m─+┼/u);
  });
});
