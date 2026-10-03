import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { widestLine } from "../../src/text/width.js";
import { withConfig } from "../support/frontmatter.js";

const body = (direction: string): string => `flowchart ${direction}\n  A[Hello world] --> B(Second)\n`;
const padded = (direction: string, px: string, section = "flowchart"): string =>
  withConfig({ [section]: { padding: px } }, body(direction));

// mermaid 12's `flowchart.padding`, 15px by default, scaled onto our 4 and 2 cells, each from its own default.
describe("flowchart padding", () => {
  it.each(["TD", "LR"])("mermaid's default draws our default (%s)", (direction) => {
    expect(render(padded(direction, "15"))).toBe(render(body(direction)));
  });

  it.each(["TD", "LR"])("scales each axis from its own default (%s)", (direction) => {
    expect(render(padded(direction, "30"))).toBe(render(body(direction), { paddingX: 8, paddingY: 4 }));
    expect(render(padded(direction, "0"))).toBe(render(body(direction), { paddingX: 0, paddingY: 0 }));
  });

  it.each(["TD", "LR"])("wins over the caller's option, in the init directive too (%s)", (direction) => {
    const directive = `%%{init: {"flowchart": {"padding": 30}}}%%\n${body(direction)}`;
    expect(render(padded(direction, "30"), { paddingX: 1, paddingY: 1 })).toBe(render(body(direction), { paddingX: 8, paddingY: 4 }));
    expect(render(directive)).toBe(render(body(direction), { paddingX: 8, paddingY: 4 }));
  });

  it.each(["TD", "LR"])("is painted the same way (%s)", (direction) => {
    expect(renderThemed(padded(direction, "30"), {}, "default")).toBe(renderThemed(body(direction), { paddingX: 8, paddingY: 4 }, "default"));
  });

  it.each(["TD", "LR"])("leaves the fit free to tighten below it (%s)", (direction) => {
    expect(widestLine(render(padded(direction, "45"), { width: 30 }))).toBeLessThanOrEqual(30);
  });

  it.each(["TD", "LR"])("says nothing under another section or unread (%s)", (direction) => {
    expect(render(padded(direction, "45", "state"))).toBe(render(body(direction)));
    expect(render(padded(direction, "wide"))).toBe(render(body(direction)));
  });
});
