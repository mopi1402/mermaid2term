import { describe, expect, it } from "vitest";
import { themeAsked } from "../../src/paint/frontmatter.js";

const withVariables = (lines: string): string =>
  `---\nconfig:\n  theme: base\n  themeVariables:\n${lines}---\nsequenceDiagram\n    A->>B: hi\n`;

// `theme-base.js`: `actorBorder = actorBorder || primaryBorderColor`, never the node's stroke.
describe("a participant's border falls back on primaryBorderColor, as mermaid", () => {
  it("keeps the primary border when only nodeBorder is written", () => {
    const th = themeAsked(withVariables('    primaryColor: "#336699"\n    nodeBorder: "#ff0000"\n'), "base");
    expect(th.variables.actorBorder).toBe(th.variables.primaryBorderColor);
    expect(th.variables.actorBorder).not.toBe("#ff0000");
  });

  it("follows a written primaryBorderColor, its lifeline too", () => {
    const th = themeAsked(withVariables('    primaryBorderColor: "#00aa00"\n'), "base");
    expect(th.variables.actorBorder).toBe("#00aa00");
    expect(th.variables.actorLineColor).toBe("#00aa00");
  });
});
