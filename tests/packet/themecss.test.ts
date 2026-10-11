import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number): string =>
  renderThemed(withConfig({ themeCSS: `"${css}"` }, `packet\n  0-15: "Source Port"\n  16-31: "Destination Port"\n`), { width, background: "light" }, "default");

// Measured on mermaid 12.0.0 headless: `.packetBlock` strokes a field's box, `.packetLabel` fills its name.
describe("a packet's own selectors in themeCSS", () => {
  it.each([60, 100])("`.packetBlock` inks the boxes (width %i)", (width) => {
    expect(runOf(drawn(".packetBlock { stroke: #ff0000; }", width), "╭")).toContain("38;2;255;0;0");
  });

  it.each([60, 100])("`.packetLabel` inks a field's name (width %i)", (width) => {
    expect(runOf(drawn(".packetLabel { fill: #00aa00; }", width), "Source")).toContain("38;2;0;170;0");
  });
});
