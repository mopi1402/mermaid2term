import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { SECTION_FOREGROUND_PREFIX, indexed } from "../../src/canvas/keys.js";

// mermaid 12 counts a journey's section over the seven `sectionFills`, the eighth back on `.section-type-0`, and
// `redux` fills its third to seventh sections from `hsl()` fillTypes, #FEECFD first (checked headless on 2026-09-29).
const SOURCE = ["journey", ...Array.from({ length: 9 }, (_, at) => `  section S${at}\n    t${at}: 5: Me`)].join("\n");

const THEMES: ReadonlyArray<readonly [string, "light" | "dark"]> = [
  ["redux", "light"],
  ["redux-dark", "dark"],
  ["redux-color", "light"],
  ["redux-dark-color", "dark"],
];

describe.each([60, 100])("a journey's sections on mermaid 12's redux packs, at width %i", (width) => {
  const inkOf = (theme: string, background: "light" | "dark", at: number): string =>
    renderThemedText(SOURCE, { width, background }, theme).rows.flat().find((cell) => cell.owner === indexed(SECTION_FOREGROUND_PREFIX, at) && cell.ch.trim() !== "")?.style ?? "";

  it.each(THEMES)("brings the eighth section of %s back on the first one's fill", (theme, background) => {
    expect(inkOf(theme, background, 7)).toBe(inkOf(theme, background, 0));
    expect(inkOf(theme, background, 8)).toBe(inkOf(theme, background, 1));
  });

  it("inks every one of redux's seven sections, its hsl() fills read", () => {
    const inks = Array.from({ length: 7 }, (_, at) => inkOf("redux", "light", at));
    expect(inks.every((ink) => ink !== "")).toBe(true);
    expect(new Set(inks).size).toBe(7);
  });
});
