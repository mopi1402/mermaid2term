import { describe, expect, it } from "vitest";

import { render, renderThemed } from "../../src/index.js";
import { parsePacket } from "../../src/diagrams/packet/parser.js";
import { TWO_PANES } from "../support/drawn.js";
import { withConfig } from "../support/frontmatter.js";
import { ESC } from "../../src/paint/escapes.js";

const inked = (hex: string, word: string): RegExp => {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  return new RegExp(`${ESC}\\[[0-9;]*38;2;${r};${g};${b}m${word}`, "u");
};
const vars = (lines: string): string => withConfig(`  themeVariables:\n    packet:\n${lines}`, "");
const BODY = 'packet\n  title Tt\n  0-15: "Aa"\n  16-31: "Bb"\n';

// Measured on mermaid 12.0.0 headless, 2026-09-29.
describe("a packet's own theme variables", () => {
  it.each(TWO_PANES)("width %i: labelColor inks a field's name and titleColor the title", (width) => {
    const out = renderThemed(`${vars('      labelColor: "#0000ff"\n      titleColor: "#888800"\n')}${BODY}`, { width }, "default");
    expect(out).toMatch(inked("#0000ff", "Aa"));
    expect(out).toMatch(inked("#888800", "Tt"));
  });

  it.each(TWO_PANES)("width %i: titleColor inks a frontmatter title as well", (width) => {
    const source = `---\ntitle: Front\nconfig:\n  themeVariables:\n    packet:\n      titleColor: "#888800"\n---\npacket\n  0-15: "Aa"\n`;
    expect(renderThemed(source, { width }, "default")).toMatch(inked("#888800", "Front"));
  });

  it.each(TWO_PANES)("width %i: the same keys through an init directive", (width) => {
    const source = `%%{init: {"themeVariables": {"packet": {"labelColor": "#0000ff"}}}}%%\n${BODY}`;
    expect(renderThemed(source, { width }, "default")).toMatch(inked("#0000ff", "Aa"));
  });

  it.each(TWO_PANES)("width %i: unwritten, the name and the title keep the theme's label ink", (width) => {
    const out = renderThemed(BODY, { width }, "default");
    expect(out).not.toMatch(inked("#0000ff", "Aa"));
  });
});

describe("a packet block on the header line", () => {
  it.each(TWO_PANES)("width %i: is read, as mermaid needs no line end after the keyword", (width) => {
    expect(parsePacket('packet 0-15: "A"\n  16-31: "B"\n').fields.map((field) => field.label)).toEqual(["A", "B"]);
    expect(render('packet 0-15: "Aa"\n  16-31: "Bb"\n', { width })).toContain("Aa");
  });
});
