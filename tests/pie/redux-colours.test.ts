// mermaid 12's two colour redux files fill `pie1..pie12` from their `cScale0..11`, and redux-dark-color alone pins the
// slice text to #28253D while its title and legend keep #CCCCCC.

import { describe, expect, it } from "vitest";

import { renderThemed } from "../../src/index.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { parseHex, type RGB } from "../../src/colour/rgb.js";
import { getTheme } from "../../src/paint/catalogue.js";
import { pageInk } from "../../src/paint/sections.js";
import { must } from "../../src/must.js";
import { INK, rgbOf, runsOf, type Run } from "../support/ansi.js";

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const WIDTHS = [60, 120];
const MERMAID_SCALE = [
  "#F4A8FF", "#46ECD5", "#FFB86A", "#DAB2FF", "#7BF1A8", "#C4B4FF",
  "#FFA2A2", "#FFDF20", "#A3B3FF", "#BBF451", "#74D4FF", "#FFA1AD",
];

const inkOf = (codes: string): RGB | undefined => rgbOf(codes, INK);
const isFill = ([, text]: Run): boolean => text !== "" && [...text].every((ch) => ch === UNICODE.sliceFill);
const barInks = (lines: readonly string[]): Array<RGB | undefined> =>
  runsOf(must(lines.find((line) => runsOf(line).some(isFill)))).filter(isFill).map(([codes]) => inkOf(codes));
const textInk = (lines: readonly string[], word: string): RGB | undefined =>
  inkOf(must(lines.flatMap(runsOf).find(([, text]) => text.trim() === word), word)[0]);

const LABELS = Array.from({ length: 13 }, (_, i) => `Kind${String.fromCharCode(65 + i)}`);
const PIE = "pie title Pets\n" + LABELS.map((label, i) => `  "${label}" : ${i === 0 ? 20 : 10}`).join("\n");
const drawn = (theme: string, side: "light" | "dark", width: number): string[] =>
  renderThemed(PIE, { width, background: side }, theme).split("\n");
const hex = (ink: string): RGB => must(parseHex(ink.toLowerCase()));

describe("the colour redux themes paint pie slices in mermaid 12's cScale", () => {
  for (const width of WIDTHS) {
    it(`fills redux-dark-color's slices with cScale0..11 on a dark page, the thirteenth the first's, at ${width}`, () => {
      const bar = barInks(drawn("redux-dark-color", "dark", width));
      expect(bar).toEqual([...MERMAID_SCALE, MERMAID_SCALE[0]].map(hex));
    });

    it(`fills redux-color's slices with cScale0..11 kept readable on a light page, at ${width}`, () => {
      const weight = getTheme("redux-color").weights.node;
      const bar = barInks(drawn("redux-color", "light", width));
      expect(bar.slice(0, 12)).toEqual(MERMAID_SCALE.map((ink) => hex(pageInk(WHITE, hex(ink), weight))));
    });

    // On a dark page the slice text keeps #28253D's violet, lifted to read, apart from the #CCCCCC title.
    it(`inks redux-dark-color's slice text from #28253D and its title #CCCCCC, at ${width}`, () => {
      const lines = drawn("redux-dark-color", "dark", width);
      const slice = must(textInk(lines, "14%"));
      expect(textInk(lines, "Pets")).toEqual(hex("#CCCCCC"));
      expect(slice.b).toBeGreaterThan(slice.r);
      expect(slice.r).toBeGreaterThan(slice.g);
    });
  }
});
