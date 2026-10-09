import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";

const source = (direction: string): string =>
  `timeline ${direction}\n    section Early\n        2002 : Seoul\n    section Late\n        2004 : Busan\n`;

// The SGR parameters the first run of `word` is written in.
const codeOf = (out: string, word: string): string | undefined => new RegExp(`\\[([0-9;]*)m[^\\[]*${word}`, "u").exec(out)?.[1];

// mermaid 12 draws an event as a box of its section, `drawNode(..., sectionColor, ...)`: its words take the section's
// ink, as the period's do, never an italic edge label.
describe("a timeline event is inked as its section, as mermaid", () => {
  it.each(["LR", "TD"])("writes each event in its own period's ink (%s)", (direction) => {
    const out = renderThemed(source(direction), { width: 80, background: "light" }, "default");
    expect(codeOf(out, "Seoul")).toBe(codeOf(out, "2002"));
    expect(codeOf(out, "Busan")).toBe(codeOf(out, "2004"));
    expect(codeOf(out, "Seoul")).not.toBe(codeOf(out, "Busan"));
    expect(codeOf(out, "Seoul")).not.toMatch(/^3;|;3;|^3$/u);
  });
});

// `.lineWrapper line { stroke: cScaleLabel<i> }` laid once per seat, the last one, `cScaleLabel11`, winning.
describe("a timeline's axis is drawn in cScaleLabel11, as mermaid", () => {
  it("strokes forest's axis in its #000000 and leaves the arrowhead on textColor", () => {
    const out = renderThemed(source("LR"), { width: 80, background: "light" }, "forest");
    expect(out).toMatch(/\[38;2;0;0;0m─/u);
  });

  it("follows a written cScaleLabel11", () => {
    const head = '---\nconfig:\n  theme: default\n  themeVariables:\n    cScaleLabel11: "#aa0000"\n---\n';
    const out = renderThemed(head + source("LR"), { width: 80, background: "light" }, "default");
    expect(out).toMatch(/\[38;2;170;0;0m─/u);
  });
});
