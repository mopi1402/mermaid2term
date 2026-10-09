import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { runOf } from "../support/ansi.js";

const drawn = (css: string, compact: boolean, width: number): string =>
  renderThemed(
    `---\n${compact ? "displayMode: compact\n" : ""}config:\n  themeCSS: "${css}"\n---\ngantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section Build\n  A long task name here : a, 2026-03-02, 20d\n  Done : done, b, 2026-03-02, 3d\n`,
    { width, background: "light" },
    "default"
  );

const cases = [false, true].flatMap((compact) => [60, 100].map((width) => [compact, width] as const));

// Measured on mermaid 12.0.0 headless: `.task` fills every bar, done ones included, `.titleText` inks the title and
// `.sectionTitle` a section's name.
describe("a gantt's own selectors in themeCSS", () => {
  it.each(cases)("`.task` paints every bar (compact %s, width %i)", (compact, width) => {
    const text = drawn(".task { fill: #ff0000; }", compact, width);
    expect(text).toMatch(compact ? /48;2;255;0;0/u : /38;2;255;0;0[0-9;]*m[█▆▇]/u);
  });

  it.each(cases)("`.titleText` and `.sectionTitle` ink the titles (compact %s, width %i)", (compact, width) => {
    const text = drawn(".titleText { fill: #ff0000; } .sectionTitle { fill: #00aa00; }", compact, width);
    expect(runOf(text, "Plan")).toContain("38;2;255;0;0");
    expect(runOf(text, "Build")).toContain("38;2;0;170;0");
  });

  it.each(cases)("`.grid .tick` inks the grid by its stroke (compact %s, width %i)", (compact, width) => {
    expect(drawn(".grid .tick { stroke: #ff0000; }", compact, width)).toContain("38;2;255;0;0");
  });
});
