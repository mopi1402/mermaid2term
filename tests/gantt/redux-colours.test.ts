import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { hexOf, runsOf, stripSgr, type Run } from "../support/ansi.js";

const SOURCE = `gantt
  title Plan
  dateFormat YYYY-MM-DD
  section Build
  Plain task   :a, 2026-03-02, 3d
  Done task    :done, b, after a, 2d
  section Test
  Crit task    :crit, d, after b, 2d
  section Ship
  Late         :e, after d, 2d
  section Four
  Last         :f, after e, 2d
  vert Freeze  :vert, v1, 2026-03-05, 0d
`;

const rowOf = (lines: readonly string[], text: string): Run[] => runsOf(must(lines.find((line) => stripSgr(line).includes(text))));

const codesOf = (lines: readonly string[], row: string, glyph: string): string => must(rowOf(lines, row).find(([, text]) => text.includes(glyph)))[0];

// mermaid 12's `redux-color` and `redux-dark-color` resolve `sectionBkgColor` and `sectionBkgColor2` to `cScale0` and
// `cScale1`, `redux-dark-color` its `altSectionBkgColor` to `#333`, and both dark packs `doneTaskBkgColor` to #38383E
// (checked headless on 2026-09-29).
describe.each([80, 120])("a gantt on mermaid 12's redux packs, at width %i", (width) => {
  const drawn = (theme: string, background: "light" | "dark"): string[] => renderThemed(SOURCE, { width, background }, theme).split("\n");
  const bands = (lines: readonly string[]): Array<string | undefined> =>
    ["Build", "Test", "Ship", "Four"].map((title) => hexOf(codesOf(lines, title, title), "48"));

  it("washes the sections of redux-color in cScale0, white, cScale1, white", () => {
    expect(bands(drawn("redux-color", "light"))).toEqual(["#fdeeff", "#ffffff", "#dafbf7", "#ffffff"]);
  });

  it("washes the sections of redux-dark-color in cScale0, #333, cScale1, #333", () => {
    expect(bands(drawn("redux-dark-color", "dark"))).toEqual(["#312233", "#0a0a0a", "#0e2f2b", "#0a0a0a"]);
  });

  it("draws a vert marker of redux-color in its #171717 border", () => {
    const lines = drawn("redux-color", "light");
    expect(hexOf(codesOf(lines, "Freeze", "Freeze"), "38")).toBe("#171717");
  });

  it.each(["redux-dark", "redux-dark-color"])("fills a done bar of %s off #38383E, never the light grey", (theme) => {
    expect(hexOf(codesOf(drawn(theme, "dark"), "Done task", "█"), "38")).toBe("#a8a8ba");
  });
});
