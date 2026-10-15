import { describe, expect, it } from "vitest";

import { render, renderThemed } from "../../src/index.js";
import { stripSgr } from "../support/ansi.js";
import { ESC } from "../../src/paint/escapes.js";
import { TWO_PANES } from "../support/drawn.js";

const bare = (source: string, width: number): string => stripSgr(renderThemed(source, { width }, "default"));
const inked = (source: string, width: number, code: string, word: string): boolean =>
  new RegExp(`${ESC}\\[(?:[0-9;]*;)?${code}(?:;[0-9;]*)?m[^${ESC}]*${word}`, "u").test(renderThemed(source, { width }, "default"));

// Measured on mermaid 12.0.0 headless: a kanban label is markdown, fenced or not, `<br>` breaks it and `<b>` `<i>`
// ink it; a block label reads the tags alone, `**` staying text.
describe("kanban labels as mermaid 12's html labels draw them", () => {
  const SOURCE = 'kanban\n  todo[Todo <b>T</b>]\n    a[one<br>two]\n    b["`**bold** text`"]\n    c[<b>x</b> <i>y</i>]\n    d[plain **star**]\n';

  it.each(TWO_PANES)("width %i: `<br>` breaks a card over two rows", (width) => {
    const rows = render(SOURCE, { width }).split("\n");
    expect(rows.join("\n")).not.toContain("<br>");
    const one = rows.findIndex((row) => row.includes("│one"));
    expect(rows[one + 1]).toMatch(/│two\s*│/u);
  });

  it.each(TWO_PANES)("width %i: markdown and tags ink their words, markers and tags gone", (width) => {
    const out = bare(SOURCE, width);
    for (const shown of ["bold text", "x y", "plain star", "Todo T"]) expect(out).toContain(shown);
    for (const marker of ["**", "`", "<b>", "<i>"]) expect(out).not.toContain(marker);
    for (const word of ["bold", "x", "star", "T"]) expect(inked(SOURCE, width, "1", word)).toBe(true);
    expect(inked(SOURCE, width, "3", "y")).toBe(true);
  });
});

describe("block labels as mermaid 12's html labels draw them", () => {
  const SOURCE = 'block-beta\n  a["<b>x</b> <i>y</i>"] d["**s** t"]\n';

  it.each(TWO_PANES)("width %i: `<b>` `<i>` ink their words, `**` stays text", (width) => {
    const out = bare(SOURCE, width);
    expect(out).toContain("x y");
    expect(out).not.toContain("<b>");
    expect(out).toContain("**s** t");
    expect(inked(SOURCE, width, "1", "x")).toBe(true);
    expect(inked(SOURCE, width, "3", "y")).toBe(true);
  });
});
