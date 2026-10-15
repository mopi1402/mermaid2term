import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, direction: string): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, `gitGraph ${direction}:\n  title Plan\n  commit id: "A"\n  commit id: "B" tag: "v1"\n  branch dev\n  commit id: "C"\n  checkout main\n  merge dev id: "M"\n`),
    { width: 80, background: "light" },
    "default"
  );

// Measured on mermaid 12.0.0 headless: `.commit` fills every bullet, `.branch` strokes the branch line, `.labelN` fills
// branch N's name tag, `.tag-label` and `.gitTitleText` ink their text and `.commit-label-bkg` fills a commit id's box.
describe("a gitGraph's own selectors in themeCSS", () => {
  it.each(["LR", "TB"])("`.commit` inks every bullet and `.branch` the branch line (%s)", (direction) => {
    const text = drawn(".commit { fill: #ff0000; } .branch { stroke: #00aa00; }", direction);
    expect(text).toMatch(/38;2;255;0;0m●/u);
    expect(text).toMatch(/38;2;0;170;0m[╌┊]/u);
  });

  it.each(["LR", "TB"])("the texts and their grounds take their own selectors (%s)", (direction) => {
    const text = drawn(
      ".gitTitleText { fill: #0000ff; } .tag-label { fill: #ff00ff; } .label1 { fill: #ffff00; } .commit-label-bkg { fill: #00ffff; }",
      direction
    );
    expect(runOf(text, "Plan")).toContain("38;2;0;0;255");
    expect(runOf(text, "v1")).toContain("38;2;255;0;255");
    expect(runOf(text, "dev")).toContain("48;2;255;255;0");
    expect(runOf(text, " A ")).toContain("48;2;0;255;255");
  });
});
