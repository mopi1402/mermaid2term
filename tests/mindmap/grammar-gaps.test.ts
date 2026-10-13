import { describe, expect, it } from "vitest";

import { render, renderThemed } from "../../src/index.js";
import { parseMindmap } from "../../src/diagrams/mindmap/parser.js";
import { stripSgr } from "../support/ansi.js";
import { ESC } from "../../src/paint/escapes.js";
import { TWO_PANES } from "../support/drawn.js";

const labels = (source: string): string[] => {
  const root = parseMindmap(source).root;
  return root === undefined ? [] : [root.label, ...root.children.map((child) => child.label)];
};

// Measured on mermaid 12.0.0 headless, 2026-09-29.
describe("mindmap forms mermaid 12's lexer reads", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["id-)text(-", "text"],
    ["-)text(-", "text"],
    ["id(-text-)", "text-"],
    ["my id[text]", "text"],
    ["my id((text))", "text"],
    ["a.b[text]", "text"],
    ["a:b(text)", "text"],
    ["é[text]", "text"],
    ["A (x)", "x"],
  ];

  it.each(cases)("`%s` shows `%s`", (written, shown) => {
    const source = `mindmap\n  r\n    ${written}\n`;
    expect(labels(source)).toEqual(["r", shown]);
    for (const width of TWO_PANES) {
      const drawing = render(source, { width });
      expect(drawing).toContain(shown);
      expect(drawing).not.toContain(written);
    }
  });

  it("keeps the forms mermaid throws on drawn as before", () => {
    expect(labels("mindmap\n  r\n    id[a (b) c]\n    id{{a {b} c}}\n    id[]\n")).toEqual(["r", "a (b) c", "a {b} c", "id[]"]);
  });

  it.each(TWO_PANES)("width %i: the header line's node is the root, the spaces after the keyword its indent", (width) => {
    const source = "mindmap Root\n  A\n  B\n";
    expect(labels(source)).toEqual(["Root", "A", "B"]);
    expect(labels("mindmap\troot((R))\n  A\n")).toEqual(["R", "A"]);
    const drawing = render(source, { width });
    for (const word of ["Root", "A", "B"]) expect(drawing).toContain(word);
  });

  it.each(TWO_PANES)("width %i: `<b>` and `<i>` ink their words, the tags gone", (width) => {
    const source = "mindmap\n  r\n    <b>bold</b> and <i>it</i>\n";
    const painted = renderThemed(source, { width }, "default");
    expect(stripSgr(painted)).toContain("bold and it");
    expect(painted).toMatch(new RegExp(`${ESC}\\[3;[0-9;]*mit`, "u"));
    expect(render(source, { width })).not.toContain("<b>");
  });
});
