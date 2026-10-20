import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { MAX_PADDING_CELLS } from "../../src/source/source.js";
import { withConfig } from "../support/frontmatter.js";

const FAST_MS = 2000;
const flowchart = (direction: string): string => `graph ${direction}\n  A-->B\n`;
const timed = (draw: () => string): number => {
  const started = performance.now();
  draw();
  return performance.now() - started;
};

// A padding read from the source stops at a few cells: 99999px once took seconds and a gigabyte before throwing.
describe("a padding the source gives is capped", () => {
  for (const direction of ["TD", "LR"]) {
    it(`flowchart, ${direction}`, () => {
      const source = withConfig({ flowchart: { padding: "99999" } }, flowchart(direction));
      expect(timed(() => render(source, { width: 80 }))).toBeLessThan(FAST_MS);
      expect(render(source, { width: 80 })).toBe(render(withConfig({ flowchart: { padding: "1000" } }, flowchart(direction)), { width: 80 }));
      expect(render(source)).toBe(render(flowchart(direction), { paddingX: MAX_PADDING_CELLS, paddingY: MAX_PADDING_CELLS }));
    });

    it(`init directive, ${direction}`, () => {
      expect(timed(() => render(`%%{init: {"flowchart": {"padding": 99999}}}%%\n${flowchart(direction)}`, { width: 80 }))).toBeLessThan(FAST_MS);
    });
  }

  it("block", () => {
    const block = (px: string): string => withConfig({ block: { padding: px } }, "block\n  a b\n");
    expect(timed(() => render(block("99999"), { width: 80 }))).toBeLessThan(FAST_MS);
    expect(render(block("99999"))).toBe(render(block("1000")));
  });
});
