import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, direction: string): string =>
  renderThemed(withConfig({ themeCSS: `"${css}"` }, `flowchart ${direction}\n  A --> B\n`), { width: 60, background: "light" }, "default");

const RED = "38;2;255;0;0";

// Measured on mermaid 12.0.0 headless: no element carries `.edgePath` nor
// `.arrowheadPath`, so those rules paint nothing, where `.flowchart-link` and `.marker` do.
describe("themeCSS selectors mermaid 12 lays on no element", () => {
  it.each(["TD", "LR"])("leave the edge and its head as they were (%s)", (direction) => {
    expect(drawn(".edgePath .path { stroke: #ff0000; } .arrowheadPath { fill: #ff0000; }", direction)).not.toContain(RED);
  });

  it.each(["TD", "LR"])("while the selectors mermaid reads paint them (%s)", (direction) => {
    expect(drawn(".flowchart-link { stroke: #ff0000; }", direction)).toContain(RED);
    expect(drawn(".marker { fill: #ff0000; }", direction)).toContain(RED);
  });
});
