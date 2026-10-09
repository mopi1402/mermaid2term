import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { EDGE, SECTION_FOREGROUND_PREFIX, SECTION_PREFIX, TIMELINE_EVENT_PREFIX, indexed } from "../../src/canvas/keys.js";

// mermaid 12's redux timeline stylesheet strokes a section `nodeBorder`, `redux-color` and `redux-dark-color` in their
// `borderColorArray` seat (#E879F9, #2DD4BF, ...), never `cScale`, and writes the events and draws the
// `.lineWrapper` lines in `nodeBorder`; a section's box is filled `mainBkg`, but on `redux-color` where it wears its
// seat, and named in `nodeBorder` (checked headless on 2026-09-29).
const source = (direction: string): string =>
  [`timeline ${direction}`, ...Array.from({ length: 13 }, (_, at) => `  section S${at}\n    p${at} : e${at}`)].join("\n");

type Ground = "light" | "dark";

const PLAIN: ReadonlyArray<readonly [string, Ground, string]> = [
  ["redux", "light", "#28253D"],
  ["redux-dark", "dark", "#FFFFFF"],
];

describe.each(["LR", "TD"])("a timeline %s on mermaid 12's redux packs", (direction) => {
  const styleOf = (theme: string, background: Ground, owner: string): string =>
    renderThemedText(source(direction), { width: 100, background }, theme).rows.flat().find((cell) => cell.owner === owner && cell.ch.trim() !== "")?.style ?? "";
  const section = (at: number): string => indexed(SECTION_FOREGROUND_PREFIX, at);

  it("strokes the sections of redux-dark-color in its borderColorArray, the thirteenth back on the first", () => {
    expect([0, 1, 2, 11].map((at) => styleOf("redux-dark-color", "dark", section(at)))).toEqual(["bold #E879F9", "bold #2DD4BF", "bold #FB923C", "bold #FB7185"]);
    expect(styleOf("redux-dark-color", "dark", section(12))).toBe(styleOf("redux-dark-color", "dark", section(0)));
  });

  it("strokes the sections of redux-color off its borderColorArray, never cScale", () => {
    expect([0, 1].map((at) => styleOf("redux-color", "light", section(at)))).toEqual(["bold #E771F9", "bold #25B4A2"]);
  });

  it.each(PLAIN)("draws every section, event and line of %s in nodeBorder", (theme, background, border) => {
    expect(new Set([0, 1, 5].map((at) => styleOf(theme, background, section(at))))).toEqual(new Set([`bold ${border}`]));
    // A timeline drawn down has no axis of its own, its lines are the sections'.
    expect(styleOf(theme, background, EDGE)).toBe(direction === "LR" ? border : "");
    expect(styleOf(theme, background, indexed(TIMELINE_EVENT_PREFIX, 0))).toBe(`bold ${border}`);
  });
});

const BANDED = "timeline\n  section Design\n    Wireframes : Sketches\n  section Build\n    Frontend : React";

const BANDS: ReadonlyArray<readonly [string, Ground, string, string]> = [
  ["redux", "light", "bold #28253D on #FFFFFF", "bold #28253D on #FFFFFF"],
  ["redux-dark", "dark", "bold #FFFFFF on #111113", "bold #FFFFFF on #111113"],
  ["redux-color", "light", "bold #28253D on #E879F9", "bold #28253D on #2DD4BF"],
  ["redux-dark-color", "dark", "bold #FFFFFF on #111113", "bold #FFFFFF on #111113"],
];

describe.each([40, 60])("a timeline's section bands on mermaid 12's redux packs, at width %i", (width) => {
  it.each(BANDS)("fills and names the bands of %s as mermaid's section boxes", (theme, background, first, second) => {
    const cells = renderThemedText(BANDED, { width, background }, theme).rows.flat();
    const band = (at: number): string => cells.find((cell) => cell.owner === indexed(SECTION_PREFIX, at) && cell.ch.trim() !== "")?.style ?? "";
    expect([band(0), band(1)]).toEqual([first, second]);
  });
});
