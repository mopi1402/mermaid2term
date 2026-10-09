import { describe, it, expect } from "vitest";
import { renderThemed } from "../../src/index.js";
import { getTheme } from "../../src/paint/catalogue.js";
import { QUIET_RATIO, contrastRatio } from "../../src/colour/contrast.js";
import { type RGB } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";
import { withConfig } from "../support/frontmatter.js";
import { ESC } from "../../src/paint/escapes.js";

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };
const STANDARD: Readonly<Record<string, RGB>> = { "30": BLACK, "37": { r: 229, g: 229, b: 229 } };

const runs = (drawn: string): Array<readonly [string, string]> =>
  [...drawn.matchAll(new RegExp(ESC + "\\[([0-9;]*)m([^" + ESC + "]*)", "gu"))].map((run) => [run[1], run[2]] as const);
const codesOf = (drawn: string, word: string): string => must(runs(drawn).find(([, text]) => text.includes(word)), word)[0];
const truecolor = (codes: string, lead: string): RGB | undefined => {
  const found = new RegExp(`(?:^|;)${lead};2;(\\d+);(\\d+);(\\d+)`, "u").exec(codes) ?? undefined;
  return found === undefined ? undefined : { r: Number(found[1]), g: Number(found[2]), b: Number(found[3]) };
};
const inkOf = (codes: string): RGB | undefined =>
  truecolor(codes, "38") ?? codes.split(";").map((code) => STANDARD[code]).find((rgb) => rgb !== undefined);
const groundOf = (codes: string, page: RGB): RGB => truecolor(codes, "48") ?? page;
const readable = (codes: string, page: RGB): number => contrastRatio(must(inkOf(codes), codes), groundOf(codes, page));

const NAMES = Array.from({ length: 13 }, (_, i) => `Sec${String.fromCharCode(65 + i)}q`);
const gantt = (count: number): string =>
  "gantt\n  dateFormat YYYY-MM-DD\n" +
  NAMES.slice(0, count).map((name, i) => `  section ${name}\n    T${i} :2024-01-${String(i + 1).padStart(2, "0")}, 3d`).join("\n");
const timeline = (count: number, direction: "LR" | "TD"): string =>
  `timeline ${direction}\n` + NAMES.slice(0, count).map((name, i) => `  section ${name}\n    P${i}x : e${i}`).join("\n");
const headed = (vars: string, body: string): string => withConfig(`  themeVariables:\n${vars}`, body);
const PAGES: ReadonlyArray<readonly ["light" | "dark", RGB]> = [["light", WHITE], ["dark", BLACK]];

describe("the section scale carries mermaid's twelve seats and starts over past the last", () => {
  it("transcribes cScale8 to cScale11 off mermaid's theme files", () => {
    expect(getTheme("dark").sectionColors.slice(8)).toEqual(["#154706", "#161722", "#00296F", "#01629C"]);
    expect(getTheme("default").sectionColors.slice(8)).toEqual(["#C2FF86", "#86FFC2", "#86FFFF", "#86C2FF"]);
    expect(getTheme("neutral").sectionColors.slice(8)).toEqual(["#DDDDDD", "#BBBBBB", "#999999", "#777777"]);
    // `theme-base.js` pushes seat 8's lightness past white before darkening it, keeping its hue.
    expect(getTheme("base").sectionColors[8]).toBe("#9680FF");
    for (const name of ["mono", "neon", "classic", "dracula", "forest", "redux-color"]) {
      expect(getTheme(name).sectionColors).toHaveLength(12);
    }
  });

  it("colours the ninth section on and gives the thirteenth the first one's colour, gantt and both timelines", () => {
    for (const theme of ["default", "neon"]) {
      for (const [side] of PAGES) {
        const drawnGantt = renderThemed(gantt(13), { width: 120, background: side }, theme);
        for (const drawn of [drawnGantt, renderThemed(timeline(13, "TD"), { width: 120, background: side }, theme)]) {
          const word = drawn === drawnGantt ? (i: number): string => NAMES[i] : (i: number): string => `P${i}x`;
          for (let i = 8; i < 13; i++) expect(inkOf(codesOf(drawn, word(i))), `${theme} ${side} ${i}`).toBeDefined();
          expect(codesOf(drawn, word(12))).toBe(codesOf(drawn, word(0)));
        }
        const across = renderThemed(timeline(13, "LR"), { width: 400, background: side }, theme);
        for (let i = 8; i < 13; i++) expect(truecolor(codesOf(across, NAMES[i]), "48"), `${theme} ${side} band ${i}`).toBeDefined();
        expect(codesOf(across, NAMES[12])).toBe(codesOf(across, NAMES[0]));
      }
    }
  });
});

describe("a section's ink read on the ground it is drawn on", () => {
  it("writes no gantt name nor timeline period the page cannot carry, mermaid's themes and this package's", () => {
    for (const theme of ["default", "forest", "neutral", "dark", "base", "neo", "classic", "neon", "mono", "nord"]) {
      for (const [side, page] of PAGES) {
        const g = renderThemed(gantt(10), { width: 120, background: side }, theme);
        const lr = renderThemed(timeline(10, "LR"), { width: 400, background: side }, theme);
        const td = renderThemed(timeline(10, "TD"), { width: 120, background: side }, theme);
        for (let i = 0; i < 10; i++) {
          expect(readable(codesOf(g, NAMES[i]), page), `${theme} ${side} gantt ${i}`).toBeGreaterThanOrEqual(QUIET_RATIO);
          expect(readable(codesOf(lr, `P${i}x`), page), `${theme} ${side} LR ${i}`).toBeGreaterThanOrEqual(QUIET_RATIO);
          expect(readable(codesOf(td, `P${i}x`), page), `${theme} ${side} TD ${i}`).toBeGreaterThanOrEqual(QUIET_RATIO);
          expect(readable(codesOf(lr, NAMES[i]), page), `${theme} ${side} band ${i}`).toBeGreaterThanOrEqual(QUIET_RATIO);
        }
      }
    }
  });

  it("lays mermaid's own band labels, black on default's yellow and white on its blue, not SGR 37 on pastel", () => {
    const drawn = renderThemed(timeline(3, "LR"), { width: 200, background: "light" }, "default");
    expect(codesOf(drawn, NAMES[0])).toBe("1;38;2;255;255;255;48;2;134;134;255");
    expect(codesOf(drawn, NAMES[1])).toBe("1;38;2;0;0;0;48;2;255;255;120");
  });

  it("lifts dark's second section, `#0B0000`, where it stands on a dark page", () => {
    for (const theme of ["default", "dark"]) {
      const band = codesOf(renderThemed(timeline(2, "LR"), { width: 200, background: "dark" }, theme), NAMES[1]);
      expect(band).toBe("1;38;2;211;211;211;48;2;11;0;0");
      const period = codesOf(renderThemed(timeline(2, "TD"), { width: 200, background: "dark" }, theme), "P1x");
      expect(readable(period, BLACK)).toBeGreaterThanOrEqual(QUIET_RATIO);
      const name = codesOf(renderThemed(gantt(2), { width: 120, background: "dark" }, theme), NAMES[1]);
      expect(readable(name, BLACK)).toBeGreaterThanOrEqual(QUIET_RATIO);
    }
  });

  it("keeps this package's dark palettes byte for byte on the page they were drawn for", () => {
    const period = codesOf(renderThemed(timeline(2, "TD"), { width: 200 }, "classic"), "P0x");
    expect(period).toBe("1;38;2;60;168;255");
    expect(codesOf(renderThemed(timeline(2, "LR"), { width: 200 }, "classic"), NAMES[0])).toBe("1;37;48;2;20;56;92");
  });
});

describe("a band label the source names, laid as it is written", () => {
  const vars = '    cScale0: "#ff0000"\n    cScaleLabel0: "#ffffff"\n    cScaleLabel1: "#1a1a1a"\n';

  it("keeps white on red and `#1a1a1a` on its band, on either ground and whichever way the theme is turned", () => {
    for (const theme of ["base", "mono", "forest", "default"]) {
      for (const [side] of PAGES) {
        const drawn = renderThemed(headed(vars, timeline(2, "LR")), { width: 200, background: side }, theme);
        expect(codesOf(drawn, NAMES[0]), `${theme} ${side}`).toBe("1;38;2;255;255;255;48;2;255;0;0");
        expect(inkOf(codesOf(drawn, NAMES[1])), `${theme} ${side}`).toEqual({ r: 26, g: 26, b: 26 });
      }
    }
  });

  it("keeps the band a named label stands on as the theme gave it, unturned for the ground", () => {
    const drawn = renderThemed(headed(vars, timeline(2, "LR")), { width: 200, background: "dark" }, "base");
    expect(truecolor(codesOf(drawn, NAMES[1]), "48")).toEqual({ r: 203, g: 93, b: 255 });
  });
});
