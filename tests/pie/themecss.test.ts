import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, `pie showData\n  title Pets\n  "Dogs" : 386\n  "Cats" : 85\n`),
    { width, background: "light" },
    "default"
  );

// Measured on mermaid 12.0.0 headless: `.pieCircle` fills every slice, `.slice` inks a percentage, `.pieTitleText` the
// title and `.legend text` a legend label.
describe("a pie's own selectors in themeCSS", () => {
  it.each([40, 100])("`.pieCircle` paints every slice (width %i)", (width) => {
    const text = drawn(".pieCircle { fill: #ff0000; }", width);
    expect([...text.matchAll(/38;2;255;0;0m[█▓▒░]/gu)].length).toBeGreaterThan(1);
  });

  it.each([40, 100])("`.pieTitleText`, `.legend text` and `.slice` ink their texts (width %i)", (width) => {
    const text = drawn(".pieTitleText { fill: #ff0000; } .legend text { fill: #00aa00; } .slice { fill: #0000ff; }", width);
    expect(runOf(text, "Pets")).toContain("38;2;255;0;0");
    expect(runOf(text, "[386]")).toContain("38;2;0;170;0");
    expect(runOf(text, "82%")).toContain("38;2;0;0;255");
  });
});
