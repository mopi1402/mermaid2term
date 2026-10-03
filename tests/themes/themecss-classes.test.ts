import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, direction: string, classDef = ""): string =>
  renderThemed(withConfig({ themeCSS: `"${css}"` }, `flowchart ${direction}\n  A:::hot --> B\n${classDef}`), { width: 60, background: "light" }, "default");

const RED_GROUND = "48;2;255;0;0";

// Measured on mermaid 12.0.0 headless: past mermaid's own `#svg .node` rules, `.hot rect` reaches the shape and
// `.hot span` the words, where `.hot`, `.hot > *` and `.hot .label` reach nothing; a `classDef` is written on the
// element itself and wins, even over `!important`.
describe("a themeCSS rule naming a class a node wears", () => {
  it.each(["TD", "LR"])("fills the shape through `.hot rect` and inks the words through `.hot span` (%s)", (direction) => {
    expect(drawn(".hot rect { fill: #ff0000; }", direction)).toContain(RED_GROUND);
    // The words alone are green, weighed against the node's fill as a `style` colour is; the outline keeps its stroke.
    expect(drawn(".hot span { color: #00ff00; }", direction)).toMatch(/38;2;0;\d+;0(;48;2;[0-9;]+)?mA/u);
  });

  it.each(["TD", "LR"])("reaches nothing through `.hot`, `.hot > *` or `.hot .label` (%s)", (direction) => {
    expect(drawn(".hot { fill: #ff0000; } .hot > * { fill: #ff0000; } .hot .label { color: #00ff00; }", direction)).not.toMatch(/48;2;255;0;0|38;2;0;255;0/u);
  });

  it.each(["TD", "LR"])("gives way to what the classDef states (%s)", (direction) => {
    expect(drawn(".hot rect { fill: #ff0000 !important; }", direction, "  classDef hot fill:#ffff00\n")).not.toContain(RED_GROUND);
  });
});
