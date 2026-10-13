import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, "kanban\n  todo[Todo]\n    t1[Write docs]\n  done[Done]\n    d1[Ship it]\n"),
    { width, background: "light" },
    "default"
  );

// Measured on mermaid 12.0.0 headless: `.section-2 rect` fills the second column's box and leaves its cards' own.
describe("a kanban's own selectors in themeCSS", () => {
  it.each([36, 100])("`.section-N rect` grounds column N alone (width %i)", (width) => {
    const text = drawn(".section-2 rect { fill: #ff0000; }", width);
    expect(runOf(text, "Done")).toContain("48;2;255;0;0");
    expect(runOf(text, "Todo")).not.toContain("48;2;255;0;0");
    expect(runOf(text, "Ship it")).not.toContain("48;2;255;0;0");
  });
});

// mermaid's `.section-N rect` reaches the column's rect, its frame included: a new fill grounds the frame too, and a
// `stroke` inks it.
describe("a kanban column's frame under `.section-N rect`", () => {
  const frameOf = (text: string): string => [...text.matchAll(/\x1b\[([0-9;]*)m([^\x1b]+)/gu)].find(([, code, run]) => run.startsWith("╭") && code.includes("48;2;255;0;0"))?.[1] ?? "";

  it.each([36, 100])("takes the new fill as its ground (width %i)", (width) => {
    expect(frameOf(drawn(".section-2 rect { fill: #ff0000; }", width))).not.toBe("");
  });

  it.each([36, 100])("takes the stroke as its ink (width %i)", (width) => {
    expect(frameOf(drawn(".section-2 rect { fill: #ff0000; stroke: #0000ff; }", width))).toContain("38;2;0;0;255");
  });
});
