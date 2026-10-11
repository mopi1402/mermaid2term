// A pie's slices take mermaid's `pie1` to `pie12`, in source order and starting over past the twelfth, on the
// circle and on the legend alike; its title, slice and legend texts take the three pie text inks.

import { describe, expect, it } from "vitest";

import { renderThemed } from "../../src/index.js";
import { LEFT_EIGHTHS } from "../../src/canvas/alphabet.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { contrastRatio, RULE_RATIO } from "../../src/colour/contrast.js";
import { parseHex, type RGB } from "../../src/colour/rgb.js";
import { getTheme } from "../../src/paint/catalogue.js";
import { derive } from "../../src/paint/derive.js";
import { MERMAID_THEME_NAMES } from "../../src/paint/mermaid-themes.js";
import { PIE_SEAT_NAMES } from "../../src/paint/theme-model.js";
import { pageInk } from "../../src/paint/sections.js";
import { must } from "../../src/must.js";
import { INK, rgbOf, runsOf, type Run } from "../support/ansi.js";
import { withConfig } from "../support/frontmatter.js";

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };
const PAGES: ReadonlyArray<readonly ["light" | "dark", RGB]> = [["light", WHITE], ["dark", BLACK]];
const FILLS = new Set([UNICODE.sliceFill, ...LEFT_EIGHTHS]);

const inkOf = (codes: string): RGB | undefined => rgbOf(codes, INK);
const isFill = ([, text]: Run): boolean => text !== "" && [...text].every((ch) => FILLS.has(ch));

const drawn = (source: string, theme: string, side: "light" | "dark"): string[] =>
  renderThemed(source, { width: 120, background: side }, theme).split("\n");
// The stacked bar is the first row made of fills, each legend row the one opening on the slice's label.
const barInks = (lines: readonly string[]): Array<RGB | undefined> =>
  runsOf(must(lines.find((line) => runsOf(line).some(isFill)))).filter(isFill).map(([codes]) => inkOf(codes));
const legendInk = (lines: readonly string[], label: string): RGB | undefined =>
  inkOf(must(runsOf(must(lines.find((line) => runsOf(line).some(([, text]) => text.trim() === label)), label)).find(isFill))[0]);
const textInk = (lines: readonly string[], word: string): RGB | undefined =>
  inkOf(must(lines.flatMap(runsOf).find(([, text]) => text.trim() === word), word)[0]);

const LABELS = Array.from({ length: 13 }, (_, i) => `Kind${String.fromCharCode(65 + i)}`);
const pie = (count: number, head = ""): string =>
  `${head}pie title Pets\n` + LABELS.slice(0, count).map((label) => `  "${label}" : 10`).join("\n");
const pies = (theme: string): Array<string | undefined> => PIE_SEAT_NAMES.map((name) => getTheme(theme).variables[name]);

describe("each mermaid theme carries the pie seats its own file resolves", () => {
  it("transcribes pie1 to pie12 off `getThemeVariables`", () => {
    expect(pies("default")).toEqual([
      "#ECECFF", "#FFFFDE", "#B5FF20", "#B9B9FF", "#FFFF45", "#D7FF86",
      "#FF86FF", "#20FFFF", "#FF2020", "#FF20FF", "#20FF8F", "#FF5353",
    ]);
    expect(pies("forest").slice(0, 4)).toEqual(["#CDE498", "#CDFFB2", "#E1EFC0", "#8CB42F"]);
    // `theme-neutral.js` copies `cScale1..11` into `pie1..11` and lays `pie0`, cScale0, on `pie12`.
    expect(pies("neutral")[11]).toBe("#555555");
    expect(pies("neo").slice(0, 3)).toEqual(["#ECECFE", "#E9E9F1", "#FFFFFF"]);
  });

  it("leaves dark's pie12 unfilled, its file copying the scale into pie0 to pie11 only", () => {
    expect(pies("dark")[10]).toBe("#01629C");
    expect(pies("dark")[11]).toBeUndefined();
  });

  it("gives the three pie texts their theme's own inks", () => {
    const { pieTitleTextColor, pieSectionTextColor, pieLegendTextColor } = getTheme("default").variables;
    expect([pieTitleTextColor, pieSectionTextColor, pieLegendTextColor]).toEqual(["#000000", "#333333", "#000000"]);
    expect(getTheme("dark").variables.pieSectionTextColor).toBe("#CCCCCC");
  });

  it("derives base's pie from its three fills the way `theme-base.js` does", () => {
    // mermaid keeps each seat as an `hsl()` string, the hex round trip here may land one step off.
    const near = (one: RGB, other: RGB): boolean =>
      Math.max(Math.abs(one.r - other.r), Math.abs(one.g - other.g), Math.abs(one.b - other.b)) <= 1;
    const mermaid = [
      "#FFF4DD", "#F4DDFF", "#F6F9FF", "#FFE3AA", "#E3AAFF", "#C3D7FF",
      "#C5FFAA", "#FFAAC5", "#DDFFF4", "#A3FF77", "#FF77A3", "#AAFFE3",
    ];
    pies("base").forEach((ink, at) => {
      const want = must(parseHex(mermaid[at].toLowerCase()));
      expect(near(must(parseHex(must(ink).toLowerCase())), want), PIE_SEAT_NAMES[at]).toBe(true);
    });
    expect(getTheme("base").variables.pieTitleTextColor).toBe("#333333");
  });

  it("follows a primaryColor the source writes on base, as mermaid's base derivation does", () => {
    const turned = derive({ primaryColor: "#ff0000", textColor: "#123456" });
    expect([turned.pie1, turned.pie9, turned.pieSectionTextColor]).toEqual(["#ff0000", "#00FF00", "#123456"]);
  });
});

describe("a pie paints each slice in its seat's colour", () => {
  it("gives every slice its own ink, the same on the bar and on its legend row, and the thirteenth the first's", () => {
    for (const [side] of PAGES) {
      const lines = drawn(pie(13), "default", side);
      const bar = barInks(lines);
      expect(bar).toHaveLength(13);
      LABELS.forEach((label, i) => expect(legendInk(lines, label), `${side} ${label}`).toEqual(bar[i]));
      expect(bar[12]).toEqual(bar[0]);
      expect(new Set(bar.slice(0, 12).map((ink) => JSON.stringify(ink))).size).toBeGreaterThan(6);
    }
  });

  it("keeps every slice readable on either page, on every mermaid theme", () => {
    for (const theme of MERMAID_THEME_NAMES) {
      for (const [side, page] of PAGES) {
        for (const ink of barInks(drawn(pie(11), theme, side))) {
          expect(contrastRatio(must(ink, `${theme} ${side}`), page), `${theme} ${side}`).toBeGreaterThanOrEqual(RULE_RATIO);
        }
      }
    }
  });

  it("paints a pie seat the source writes as written", () => {
    const head = withConfig({ themeVariables: { pie2: '"#ff0000"' } }, "");
    const bar = barInks(drawn(pie(3, head), "dark", "dark"));
    expect(bar[1]).toEqual(parseHex("#ff0000"));
  });

  it("keeps the node's own ink on a seat the theme leaves unfilled", () => {
    const border = must(getTheme("dark").variables.nodeBorder).toLowerCase();
    expect(barInks(drawn(pie(12), "dark", "dark"))[11]).toEqual(parseHex(border));
  });

  it("inks the title, the slice texts and the legend in the pie's text colours", () => {
    const lines = drawn('pie title Pets\n  "Dogs" : 80\n  "Cats" : 20', "default", "light");
    expect(textInk(lines, "Pets")).toEqual(parseHex("#000000"));
    expect(textInk(lines, "80%")).toEqual(parseHex("#333333"));
    expect(textInk(lines, "80.0%")).toEqual(parseHex("#000000"));
  });
});

describe("pageInk with no weight", () => {
  it("keeps a colour already readable on a dark page as written, and does not brighten it", () => {
    expect(pageInk(BLACK, must(parseHex("#FF86FF")), "")).toBe("#FF86FF");
  });
});
