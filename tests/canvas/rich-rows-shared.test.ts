import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";
import { ESC } from "../../src/paint/escapes.js";

const inked = (source: string, width: number, code: string, word: string): boolean =>
  new RegExp(`${ESC}\\[(?:[0-9;]*;)?${code}(?:;[0-9;]*)?m[^${ESC}]*${word}`, "u").test(renderThemed(source, { width }, "default"));

// Measured on mermaid 12.0.0 headless (2026-09-29): a kanban card and a mindmap node are markdown labels, their inks
// kept on every row the label wraps to, a character reference shown as the character it names and never read as a tag.
describe.each([30, 40])("a kanban card folded to the board's width %i", (width) => {
  const SOURCE = "kanban\n  Todo\n    a[*Ship the whole release* before the meeting]\n  Done\n    b[x]";

  it("keeps its italic words italic on the rows they fold to", () => {
    const rows = render(SOURCE, { width }).split("\n");
    const first = rows.findIndex((row) => row.includes("Ship the"));
    expect(rows[first]).not.toContain("before");
    expect(inked(SOURCE, width, "3", "Ship")).toBe(true);
    expect(inked(SOURCE, width, "3", "release")).toBe(true);
    expect(inked(SOURCE, width, "3", "meeting")).toBe(false);
  });
});

describe.each(TWO_PANES)("character references at width %i", (width) => {
  it("decodes a mindmap node's", () => {
    const out = render("mindmap\n  root((A &amp; B))\n    c[x &lt;b&gt; y]", { width });
    expect(out).toContain("A & B");
    expect(out).toContain("x <b> y");
    expect(out).not.toContain("&amp;");
  });

  it("shows a kanban card's `&lt;b&gt;` as text, never read as a tag", () => {
    const source = "kanban\n  Todo\n    c[x &lt;b&gt;y&lt;/b&gt;]";
    expect(render(source, { width })).toContain("x <b>y</b>");
  });
});
