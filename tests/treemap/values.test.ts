import { describe, expect, it } from "vitest";

import { render, renderThemed } from "../../src/index.js";
import { parseTreemap } from "../../src/diagrams/treemap/parser.js";
import { d3Format } from "../../src/text/format.js";
import { withConfig } from "../support/frontmatter.js";
import { ESC } from "../../src/paint/escapes.js";

const WIDTHS = [80, 120] as const;
const drawn = (source: string, width: number): string => render(source, { width });
const configured = (config: string, body: string): string => withConfig(`  treemap:\n${config}`, `treemap-beta\n${body}`);
const MAP = '"S"\n  "a": 1234567\n  "b": 12.75\n';

// Measured on mermaid 12.0.0 headless, 2026-09-29.
describe("d3's format specifiers a treemap's valueFormat is written with", () => {
  it.each([
    [",", 1234567, "1,234,567"],
    [",", 1235579.751, "1,235,579.751"],
    [",", 0.001, "0.001"],
    [".2f", 1234567, "1234567.00"],
    [",.2f", 1000, "1,000.00"],
    [",d", 12.75, "13"],
    [",.2", 1234567, "1.2e+6"],
    [",.2", 1000, "1e+3"],
    [".0%", 0.25, "25%"],
    ["", 1234567, "1234567"],
  ] as const)("`%s` writes %d as `%s`", (spec, value, written) => {
    expect(d3Format(spec)?.(value)).toBe(written);
  });

  it("reads nothing else", () => {
    expect(d3Format("xyz")).toBeUndefined();
  });
});

describe("a treemap's values", () => {
  it.each(WIDTHS)("width %i: groups thousands with `,` by default and writes a section's total in its header", (width) => {
    const out = drawn(`treemap-beta\n${MAP}`, width);
    expect(out).toContain("1,234,567");
    const header = out.split("\n").find((row) => row.includes("S")) ?? "";
    expect(header).toMatch(/S\s+1,234,579\.75 ┊/u);
  });

  it.each(WIDTHS)("width %i: valueFormat and mermaid's `$` forms", (width) => {
    expect(drawn(configured('    valueFormat: ",.2f"\n', MAP), width)).toContain("1,234,567.00");
    expect(drawn(configured('    valueFormat: "$0,0"\n', MAP), width)).toContain("$1,234,567");
    expect(drawn(configured('    valueFormat: "$,.2f"\n', MAP), width)).toContain("$1.2e+6");
    expect(drawn(configured('    valueFormat: "$.1f"\n', MAP), width)).toContain("$1234567.0");
    expect(drawn(configured('    valueFormat: "xyz"\n', MAP), width)).toContain("1,234,567");
  });

  it.each(WIDTHS)("width %i: showValues false writes no value, a section's total neither", (width) => {
    const out = drawn(configured("    showValues: false\n", MAP), width);
    expect(out).not.toMatch(/\d/u);
    for (const word of ["S", "a", "b"]) expect(out).toContain(word);
  });

  it.each(WIDTHS)("width %i: a value its box cannot hold is hidden, never cut", (width) => {
    const out = drawn('treemap-beta\n"S"\n  "big": 1000000\n  "b": 1000.5\n', width);
    expect(out).not.toMatch(/│\s*1,0?\s*│/u);
    expect(out.match(/1,000\.5|1,000,000/gu)?.length ?? 0).toBeGreaterThan(0);
  });

  it.each(WIDTHS)("width %i: reads an item on the header line, the blank after the keyword its indent", (width) => {
    const treemap = parseTreemap('treemap-beta "A": 1\n"B": 2\n');
    expect(treemap.roots.map((root) => [root.label, root.value])).toEqual([["A", 1], ["B", 2]]);
    const nested = parseTreemap('treemap-beta "A"\n  "a": 1\n  "b": 2\n');
    expect(nested.roots.map((root) => [root.label, root.children.length])).toEqual([["A", 2]]);
    for (const word of ["A", "B"]) expect(drawn('treemap-beta "A": 1\n"B": 2\n', width)).toContain(word);
  });

  it.each(WIDTHS)("width %i: titleColor inks the title, the body one and the frontmatter one", (width) => {
    const red = `${ESC}[1;38;2;255;0;0mHello`;
    const vars = '---\nconfig:\n  themeVariables:\n    titleColor: "#ff0000"\n';
    expect(renderThemed(`${vars}---\ntreemap-beta\ntitle Hello\n"S"\n  "a": 1\n`, { width }, "default")).toContain(red);
    expect(renderThemed(`---\ntitle: Hello\n${vars.slice(4)}---\ntreemap-beta\n"S"\n  "a": 1\n`, { width }, "default")).toMatch(
      new RegExp(`${ESC}\\[[0-9;]*38;2;255;0;0mHello`, "u")
    );
  });
});
