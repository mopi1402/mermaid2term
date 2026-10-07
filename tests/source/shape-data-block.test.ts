import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

const boxes = (out: string): number => (out.match(/[┌╭]/gu) ?? []).length;
const CIRCLE_MARK = "◯";

// Measured on mermaid 12.0.0 headless (2026-09-29): a `@{ }` block is YAML, a single-quoted value one string, and
// mermaid's `shapeData` state runs over line ends.
describe.each(["TD", "LR"])("a flowchart `@{ }` block, %s", (direction) => {
  it("reads a single-quoted value whole, its quotes off, and a quoted shape name", () => {
    const out = render(`flowchart ${direction}\n  A@{ label: 'Hi, there', shape: 'circle' }`, { width: 80 });
    expect(out).toContain("Hi, there");
    expect(out).not.toContain("'");
    expect(out).toContain(CIRCLE_MARK);
  });

  it("reads a block written over several lines as one node", () => {
    const out = render(`flowchart ${direction}\n  A@{\n    shape: circle\n    label: "x"\n  }\n  A --> B`, { width: 80 });
    expect(boxes(out)).toBe(2);
    expect(out).toContain(CIRCLE_MARK);
    expect(out).not.toMatch(/shape|label|\}/u);
  });
});

// mermaid 12 closes its CONFIG state at the first `}` and throws; the block reader keeps the quoted one as text.
describe("a sequence participant's `@{ }` block over several lines", () => {
  it.each(TWO_PANES)("width %i: keeps a `}` inside a quoted value as text", (width) => {
    const out = render('sequenceDiagram\n  participant A@{\n  "type": "actor",\n  "alias": "Al}ice"\n  }\n  A->>B: hi', { width });
    expect(out).toContain("Al}ice");
    expect(out).toContain("☻");
    expect(out).not.toMatch(/type|@\{/u);
  });
});
