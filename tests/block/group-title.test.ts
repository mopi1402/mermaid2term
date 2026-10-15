import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

const TITLE = "A very long group title here";
const lone = `block-beta\n  block:g["${TITLE}"]\n    a\n  end\n`;
const beside = `block-beta\n  columns 2\n  block:g["${TITLE}"]\n    a\n  end\n  c\n`;

const rowOf = (drawing: string): string => drawing.split("\n").find((line) => line.includes(TITLE)) ?? "";

// A composite block is sized to its title as a subgraph is: the title stands whole between its two walls.
describe("block group title", () => {
  it.each(TWO_PANES)("stands whole between the walls at width %i", (width) => {
    for (const source of [lone, beside]) {
      const row = rowOf(render(source, { width }));
      expect(row).toMatch(/│ +A very long group title here +│/);
    }
  });

  it.each(TWO_PANES)("keeps the child inside the widened frame at width %i", (width) => {
    const drawing = render(lone, { width });
    const top = drawing.split("\n")[0];
    const child = drawing.split("\n").find((line) => line.includes(" a ")) ?? "";
    expect(child.lastIndexOf("│")).toBe(top.lastIndexOf("┐"));
    expect(child.indexOf("│")).toBe(top.indexOf("┌"));
  });
});
