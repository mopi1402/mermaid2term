import { describe, expect, it } from "vitest";
import { parseFlowchart, render, renderGraph, renderThemed } from "../../src/index.js";
import { TAB } from "../../src/text/chars.js";
import { stripSgr } from "../support/ansi.js";

const source = (direction: string, between: string): string => `flowchart ${direction}\n  A[Tests${between}FAILED] --> B[next]\n`;

// mermaid's SVG shows a tab as whitespace: drawn, it is the one column the layout counted for it.
describe("a tab in a label is drawn as a space", () => {
  for (const direction of ["TD", "LR"]) {
    it(`${direction}: plain and themed`, () => {
      const plain = render(source(direction, TAB), { width: 80 });
      expect(plain).not.toContain(TAB);
      expect(plain).toBe(render(source(direction, " "), { width: 80 }));
      expect(stripSgr(renderThemed(source(direction, TAB), { width: 80 }, "default"))).not.toContain(TAB);
    });

    it(`${direction}: through the low-level parser and renderer`, () => {
      expect(renderGraph(parseFlowchart(source(direction, TAB)))).not.toContain(TAB);
    });
  }

  it("still reads a mindmap indented by tabs", () => {
    expect(render(`mindmap\n${TAB}root\n${TAB}${TAB}child`)).toContain("child");
  });
});
