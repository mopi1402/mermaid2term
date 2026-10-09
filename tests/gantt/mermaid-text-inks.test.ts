import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";

const VARIABLES =
  '  theme: default\n  themeVariables:\n    taskTextColor: "#00aa00"\n    taskTextDarkColor: "#aa0000"\n' +
  '    taskTextOutsideColor: "#0000aa"\n    critBorderColor: "#ffffff"\n    textColor: "#663300"\n';

const head = (compact: boolean): string =>
  `---\n${compact ? "displayMode: compact\n" : ""}config:\n${VARIABLES}---\ngantt\n    dateFormat YYYY-MM-DD\n    axisFormat %m-%d\n`;

const CRIT_BARS =
  "    section S\n        Long name one :done, crit, a, 2026-02-02, 8d\n        Long name two :active, crit, b, after a, 8d\n" +
  "        Plain :d, after b, 8d\n";

// Two one-day bars on a month-long chart, too short for their names, which stand beside them.
const SHORT_BARS =
  "    section S\n        Long active name :active, c, 2026-02-02, 1d\n        Pad :e, 2026-03-01, 1d\n" +
  "    section T\n        Long plain name :d, 2026-02-02, 1d\n";

// The style of the cell spelling `word`'s first letter, on the first row that holds it.
function styleIn(text: string, word: string): string {
  for (const row of renderThemedText(text, { width: 120, background: "light" }, "default").rows) {
    const at = row.map((cell) => cell.ch).join("").indexOf(word);
    if (at !== -1) return row[at].style;
  }
  return "";
}

// mermaid 12's gantt sheet: `.doneCritText` and `.activeCritText` ink a name inside its bar `taskTextDarkColor`,
// `.activeText` outweighs the outside ink beside an active bar, and `.grid .tick text` writes the dates `textColor`.
describe("a gantt's names and dates take mermaid's own text inks", () => {
  it("writes a done or active crit name inside its compact bar in taskTextDarkColor", () => {
    expect(styleIn(head(true) + CRIT_BARS, "Long name one")).toMatch(/#aa0000/iu);
    expect(styleIn(head(true) + CRIT_BARS, "Long name two")).toMatch(/#aa0000/iu);
  });

  it("writes a name beside an active bar in taskTextDarkColor, beside a plain one in taskTextOutsideColor", () => {
    expect(styleIn(head(true) + SHORT_BARS, "Long active name")).toMatch(/#aa0000/iu);
    expect(styleIn(head(true) + SHORT_BARS, "Long plain name")).toMatch(/#0000aa/iu);
  });

  it.each([false, true])("draws the axis ticks in gridColor at 0.8 over the page, as `.grid .tick` (compact %s)", (compact) => {
    const text = head(compact).replace("themeVariables:\n", 'themeVariables:\n    gridColor: "#ff0000"\n') + CRIT_BARS;
    const page = renderThemedText(text, { width: 120, background: "light" }, "default");
    const tee = page.rows.flat().find((cell) => cell.ch === "┬");
    expect(tee?.owner).toBe("gantt_grid");
    expect(tee?.style).toMatch(/#ff3333/iu);
  });

  it("weighs a vert line's ink to read on the page", () => {
    const text = head(false).replace("themeVariables:\n", 'themeVariables:\n    vertLineColor: "#ffffff"\n') + CRIT_BARS + "        Cut :vert, v1, 2026-02-05, 0d\n";
    const cut = renderThemedText(text, { width: 120, background: "light" }, "default").rows.flat().find((cell) => cell.owner === "marker");
    expect(cut?.style).toBeDefined();
    expect(cut?.style).not.toMatch(/#ffffff/iu);
  });

  it.each([false, true])("writes the axis dates in textColor, not italic (compact %s)", (compact) => {
    const style = styleIn(head(compact) + CRIT_BARS, "02-0");
    expect(style).toMatch(/#663300/iu);
    expect(style).not.toMatch(/italic/u);
  });
});
