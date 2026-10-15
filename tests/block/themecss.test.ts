import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, width: number): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, `block-beta\n  columns 3\n  a["Start"] space b["Finish"]\n  space space c["Later"]\n  a --> b\n  b --> c\n`),
    { width, background: "light" },
    "default"
  );

// The same links laid on two or three columns, a head drawn rightward and one downward on each.
const laid = (css: string, columns: number): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, `block-beta\n  columns ${columns}\n  a["Start"] ${columns === 3 ? "space " : ""}b["Finish"]\n  ${columns === 3 ? "space " : ""}space c["Later"]\n  a --> b\n  b --> c\n`),
    { width: 100, background: "light" },
    "default"
  );

const RED = "38;2;255;0;0";
const BLUE = "38;2;0;0;255";
const runs = (text: string): Array<[string, string]> => [...text.matchAll(/\x1b\[([0-9;]*)m([^\x1b]+)/gu)].map(([, sgr, run]) => [sgr, run]);
const inked = (text: string, glyphs: RegExp, ink = RED): boolean => runs(text).some(([sgr, run]) => sgr.includes(ink) && glyphs.test(run));
const HEADS = /[⏵⏷⏴⏶]/u;

// Measured on mermaid 12.0.0 headless: a link wears `.edge-pattern-solid`, which strokes its line and leaves its head,
// and `.arrowMarkerPath` or `.marker` fills every head.
describe("a block diagram's own selectors in themeCSS", () => {
  it.each([60, 100])("`.edge-pattern-solid` strokes every link (width %i)", (width) => {
    const text = drawn(".edge-pattern-solid { stroke: #ff0000; }", width);
    expect(inked(text, /─/u)).toBe(true);
    expect(inked(text, /│/u)).toBe(true);
  });

  it.each([60, 100])("a rule it does not name leaves the links alone (width %i)", (width) => {
    expect(inked(drawn(".edge-pattern-dotted { stroke: #ff0000; }", width), /[─│]/u)).toBe(false);
  });

  it.each([2, 3])("`.edge-pattern-solid` leaves the heads in their own ink (%i columns)", (columns) => {
    const text = laid(".edge-pattern-solid { stroke: #ff0000; }", columns);
    expect(inked(text, /[─│]/u)).toBe(true);
    expect(runs(text).filter(([, run]) => HEADS.test(run))).toHaveLength(2);
    expect(inked(text, HEADS)).toBe(false);
  });

  it.each([2, 3])("`.arrowMarkerPath` and `.marker` ink the heads and not the lines (%i columns)", (columns) => {
    for (const selector of [".arrowMarkerPath", ".marker"]) {
      const text = laid(`${selector} { fill: #0000ff; }`, columns);
      expect(runs(text).filter(([sgr, run]) => sgr.includes(BLUE) && HEADS.test(run))).toHaveLength(2);
      expect(inked(text, /[─│]/u, BLUE)).toBe(false);
    }
  });
});
