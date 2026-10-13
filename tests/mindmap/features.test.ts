import { describe, expect, it } from "vitest";

import { render, renderThemed } from "../../src/index.js";
import { parseMindmap } from "../../src/diagrams/mindmap/parser.js";
import { displayWidth } from "../../src/text/width.js";
import { makeChars, painted, stackLeft } from "../../src/diagrams/mindmap/rows.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { MAX_LABEL_WIDTH } from "../../src/text/wrap.js";
import { SGR_RE, stripSgr } from "../support/ansi.js";
import { THREE_PANES } from "../support/drawn.js";

const BOLD = "1";
const ITALIC = "3";

const drawn = (source: string, width = 80): string => render(source, { width });
const rows = (source: string, width = 80): string[] => drawn(source, width).split("\n");
const column = (row: string, glyph: string): number => displayWidth(row.slice(0, row.indexOf(glyph)));

const inkOn = (source: string, word: string): string[] => {
  const painted = renderThemed(source, { width: 80 }, "classic").split("\n");
  const row = painted.find((one) => stripSgr(one).includes(word)) ?? "";
  return [...row.matchAll(SGR_RE)].flatMap((found) => found[1].split(";"));
};

describe("mindmap decorations, read as mermaid's `decorateNode` reads them", () => {
  const SOURCE = "mindmap\n  Root\n    Books\n    ::icon(fa fa-book)\n      Novels\n    Hot(Hot)\n    :::urgent large\n      Child\n    Last\n";

  it("puts an icon and a class on the node above and never makes a node of them", () => {
    const root = parseMindmap(SOURCE).root;
    expect(root?.children.map((child) => child.label)).toEqual(["Books", "Hot", "Last"]);
    expect(root?.children[0].icon).toBe("fa fa-book");
    expect(root?.children[1].classes).toBe("urgent large");
    for (const width of THREE_PANES) expect(drawn(SOURCE, width)).not.toMatch(/::icon|:::/u);
  });

  it("keeps the next lines under their own parent", () => {
    const root = parseMindmap(SOURCE).root;
    expect(root?.children[0].children.map((child) => child.label)).toEqual(["Novels"]);
    expect(root?.children[1].children.map((child) => child.label)).toEqual(["Child"]);
    for (const width of THREE_PANES) expect(drawn(SOURCE, width)).toMatch(/Hot ─+ Child|Child ─+ Hot|Hot\n +│\n +Child/u);
  });

  it("draws the charset's glyph where one stands for the icon, nothing where none does", () => {
    const source = "mindmap\n  Root\n    Sky\n    ::icon(fa fa-cloud)\n    Book\n    ::icon(fa fa-book)\n";
    expect(drawn(source)).toContain("☁ Sky");
    expect(drawn(source)).toMatch(/^ Book ─/mu);
    expect(render(source, { width: 80, charset: "compat" })).toContain("○ Sky");
  });

  it("drops a decoration read before any node", () => {
    expect(parseMindmap("mindmap\n  :::first\n  Root\n    A\n").root?.label).toBe("Root");
  });
});

describe("mindmap text, as mermaid's lexer and markdown reading hand it over", () => {
  it("strips the quotes of a quoted string, brackets kept as text", () => {
    for (const width of THREE_PANES) {
      const out = drawn('mindmap\n  root["Quoted [x]"]\n    a("in (parens)")\n', width);
      expect(out).toMatch(/Quoted \[x\] ─+ in \(parens\)/u);
      expect(out).not.toContain('"');
    }
  });

  it("drops the backticks of a markdown string and inks bold and italic", () => {
    const source = 'mindmap\n  Root\n    md["`**bold** and *it*`"]\n    plain **heavy** word\n';
    for (const width of THREE_PANES) {
      const out = drawn(source, width);
      expect(out).toContain("bold and it");
      expect(out).toContain("plain heavy word");
      expect(out).not.toMatch(/[`*]/u);
    }
    expect(inkOn(source, "bold and it")).toEqual(expect.arrayContaining([BOLD, ITALIC]));
    expect(inkOn(source, "plain heavy word")).toContain(BOLD);
  });

  it("reads a string running over two lines as one node on two rows", () => {
    const source = 'mindmap\n  Root\n    id["`**First** line\n    second line`"]\n    Next\n';
    expect(parseMindmap(source).root?.children.map((child) => child.label)).toEqual(["**First** line\nsecond line", "Next"]);
    expect(rows(source)).toEqual([" Next ──────── Root ──────── First line", "                             second line"]);
  });

  it("breaks a label at every spelling of `<br>`", () => {
    const source = "mindmap\n  Root\n    one<br>two<br/>three<br />four\n";
    for (const width of THREE_PANES) {
      const out = rows(source, width);
      const at = out.findIndex((row) => row.includes("one"));
      expect(out.slice(at, at + 4).map((row) => row.trim().split(" ").filter((word) => /^[a-z]+$/u.test(word)))).toEqual([["one"], ["two"], ["three"], ["four"]]);
      expect(out[at + 1]).toMatch(/─+/u);
    }
  });

  it("reads the bang shape's text alone", () => {
    for (const width of THREE_PANES) {
      expect(drawn("mindmap\n  Root\n    b))Bang((\n    ))Bare((\n", width)).toMatch(/^ Bare ─+ Root ─+ Bang$/u);
    }
  });

  it("wraps a long label at mermaid's own `maxNodeWidth`, a word never cut", () => {
    const source = "mindmap\n  Root\n    This label is much too long to fit on one line\n    Next\n";
    for (const width of THREE_PANES) {
      const out = rows(source, width);
      const at = out.findIndex((row) => row.includes("This label is much"));
      expect(out[at]).toContain("This label is much too long");
      expect(out[at]).not.toContain("long to");
      expect(out[at + 1]).toContain("to fit on one line");
    }
  });
});

describe("mindmap spines measured in columns", () => {
  it("keeps the children of a wide parent under the parent's connector", () => {
    for (const label of ["🤓 root", "日本語", "Plain"]) {
      const out = rows(`mindmap\n  Root\n    ${label}\n      a\n      b\n      c\n`);
      const connector = out.find((row) => row.includes(label)) ?? "";
      const spineAt = column(connector, "┼");
      expect(column(out[0], "╭")).toBe(spineAt);
      expect(column(out[2], "╰")).toBe(spineAt);
    }
  });

  it("right-aligns a wide label on the left side against its spine", () => {
    const root = parseMindmap("mindmap\n  Root\n    D\n    日本語\n      a\n    🤓 nerd\n      b\n").root;
    const branches = (root?.children ?? []).map((node, at) => ({ node, seat: at + 1 }));
    const out = painted(stackLeft(branches, makeChars(UNICODE, true, MAX_LABEL_WIDTH)).rows).toString().split("\n");
    expect(out).toEqual(["              D ─╮", "  a ──── 日本語 ─┼", " b ──── 🤓 nerd ─╯"]);
    expect(column(out[1], "┼")).toBe(column(out[0], "╮"));
    expect(column(out[2], "╯")).toBe(column(out[0], "╮"));
  });

  it("joins the root of a two-sided tree to the spine on both of its sides", () => {
    const out = rows("mindmap\n  Engine\n    Parser\n    Layout\n    Routing\n    Renderer\n    Themes\n    Tests\n    Docs\n    Packaging\n");
    expect(out).toContain("         ├──── Engine ────┤");
  });
});
