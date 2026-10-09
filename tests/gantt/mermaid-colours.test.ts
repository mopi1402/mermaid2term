import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { hexOf, runsOf, stripSgr, type Run } from "../support/ansi.js";

const source = (compact: boolean): string => `${compact ? "---\ndisplayMode: compact\n---\n" : ""}gantt
  title Plan
  dateFormat YYYY-MM-DD
  excludes weekends
  section Build
  Plain task   :a, 2026-03-02, 3d
  section Test
  Crit task    :crit, d, after a, 2d
  section Ship
  Crit done    :crit, done, e, after d, 2d
  section Four
  Late         :h, after e, 2d
`;

const drawn = (compact: boolean): string[] => renderThemed(source(compact), { width: 80, background: "light" }, "default").split("\n");

const rowOf = (lines: readonly string[], text: string): Run[] => runsOf(must(lines.find((line) => stripSgr(line).includes(text))));

const inkOf = (row: readonly Run[], glyph: string): string | undefined =>
  hexOf(must(row.find(([, text]) => text.includes(glyph)))[0], "38");

// mermaid 11.17.0, `default`: `.section{i % 4}` at `opacity: 0.2` over the page, `sectionBkgColor` carrying its own 0.49.
describe("a gantt on mermaid's default theme", () => {
  it.each([false, true])("washes each section in mermaid's four section fills, over the white page (compact %s)", (compact) => {
    const lines = drawn(compact);
    const band = (title: string): string | undefined => hexOf(must(rowOf(lines, title).find(([, text]) => text.includes(title)))[0], "48");
    expect([band("Build"), band("Test"), band("Ship"), band("Four")]).toEqual(["#f0f0ff", "#ffffff", "#fffdcc", "#ffffff"]);
  });

  it.each([false, true])("writes the section titles and the chart title in titleColor (compact %s)", (compact) => {
    const lines = drawn(compact);
    expect(inkOf(rowOf(lines, "Build"), "Build")).toBe("#333333");
    expect(inkOf(rowOf(lines, "Plan"), "Plan")).toBe("#333333");
  });

  it("fills a plain bar in taskBkgColor and a crit one in critBkgColor, a done crit bar wearing the crit stroke", () => {
    const lines = drawn(false);
    expect(inkOf(rowOf(lines, "Plain task"), "█")).toBe("#8a90dd");
    expect(inkOf(rowOf(lines, "Crit task"), "█")).toBe("#ff0000");
    expect(inkOf(rowOf(lines, "Crit done"), "█")).toBe("#ff8080");
  });

  it("grounds a compact bar in its fill, taskBkgColor or critBkgColor, a done crit bar wearing critBorderColor whole", () => {
    const lines = drawn(true);
    const ground = (text: string): string | undefined => hexOf(must(rowOf(lines, text).find(([, t]) => t.includes(text)))[0], "48");
    expect(ground("Plain task")).toBe("#8a90dd");
    expect(ground("Crit task")).toBe("#ff0000");
    expect(ground("Crit done")).toBe("#ff8888");
  });

  it("lays excludeBkgColor under the excluded days", () => {
    expect(rowOf(drawn(false), "Plain task").some(([codes]) => hexOf(codes, "48") === "#eeeeee")).toBe(true);
  });

  it("writes a name inside its compact bar on the bar's own fill, taskTextDarkColor on an active one", () => {
    const lines = renderThemed(
      "---\ndisplayMode: compact\n---\ngantt\n  dateFormat YYYY-MM-DD\n  section A\n  Plain task name :a, 2026-03-02, 20d\n  Busy task name :active, b, after a, 20d\n",
      { width: 120, background: "light" },
      "default"
    ).split("\n");
    const named = (text: string): string => must(lines.flatMap(runsOf).find(([, t]) => t.includes(text)))[0];
    expect(hexOf(named("Plain"), "48")).toBe("#8a90dd");
    expect(hexOf(named("Busy"), "48")).toBe("#bfc7ff");
    expect(hexOf(named("Busy"), "38")).toBe("#000000");
  });
});
