import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";
import { widestLine } from "../../src/text/width.js";
import { withConfig } from "../support/frontmatter.js";

const body = (columns: number): string => `block\n  columns ${columns}\n  a["Alpha"] b["Beta long label"] c["C"]\n`;
const padded = (columns: number, px: string, section = "block"): string =>
  withConfig({ [section]: { padding: px } }, body(columns));
const labelRow = (drawing: string): string | undefined => drawing.split("\n").find((line) => line.includes("Beta"));

// mermaid 12's `block.padding`, 8px by default, scaled onto our block's own 2 cells, its walls counted in.
describe("block padding", () => {
  it.each([2, 3])("mermaid's default draws our default (columns %i)", (columns) => {
    expect(render(padded(columns, "8"))).toBe(render(body(columns)));
  });

  it.each([2, 3])("scales from the block's own default, 16px reaching the shared default's 4 cells (columns %i)", (columns) => {
    expect(labelRow(render(padded(columns, "16")))).toContain("│   Beta long label   │");
    expect(labelRow(render(padded(columns, "0")))).toContain("│Beta long label│");
  });

  it.each([2, 3])("wins over the caller's option, in the init directive too (columns %i)", (columns) => {
    const directive = `%%{init: {"block": {"padding": 16}}}%%\n${body(columns)}`;
    expect(render(padded(columns, "16"), { paddingX: 1 })).toBe(render(padded(columns, "16")));
    expect(render(directive)).toBe(render(padded(columns, "16")));
  });

  it.each([2, 3])("is painted the same way (columns %i)", (columns) => {
    expect(labelRow(renderThemedText(padded(columns, "16"), {}, "default").plain)).toContain("│   Beta long label   │");
  });

  it.each([2, 3])("leaves the fit free to tighten below it (columns %i)", (columns) => {
    expect(widestLine(render(padded(columns, "30"), { width: 60 }))).toBeLessThanOrEqual(60);
  });

  it.each([2, 3])("says nothing under another section or unread (columns %i)", (columns) => {
    expect(render(padded(columns, "30", "flowchart"))).toBe(render(body(columns)));
    expect(render(padded(columns, "wide"))).toBe(render(body(columns)));
  });
});
