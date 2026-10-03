import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, direction: string): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, `stateDiagram-v2\n  direction ${direction}\n  [*] --> Idle\n  Idle --> Running : start\n  note right of Idle : a remark\n`),
    { width: 100, background: "light" },
    "default"
  );

// Measured on mermaid 12.0.0 headless: `.transition` strokes the lines, `.node rect` fills a state's box,
// `.markdown-node-label` colours a state's name and `.statediagram-note .nodeLabel` a note's words.
describe("a state diagram's own selectors in themeCSS", () => {
  it.each(["TB", "LR"])("`.transition` inks every line (%s)", (direction) => {
    expect(drawn(".transition { stroke: #ff0000; }", direction)).toMatch(/38;2;255;0;0[0-9;]*m[─│┄┆┊╭╮╰╯┌┐└┘]/u);
  });

  it.each(["TB", "LR"])("`.node rect` grounds a state's box, its name included (%s)", (direction) => {
    const text = drawn(".node rect { fill: #ffdd00; }", direction);
    expect(runOf(text, "Idle")).toContain("48;2;255;221;0");
  });

  it.each(["TB", "LR"])("a state's name and a note's words take their colour (%s)", (direction) => {
    const text = drawn(".markdown-node-label { color: #ff0000; } .statediagram-note .nodeLabel { color: #00aa00; }", direction);
    expect(runOf(text, "Idle")).toContain("38;2;255;0;0");
    expect(runOf(text, "remark")).toContain("38;2;0;170;0");
  });
});
