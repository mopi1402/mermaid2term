import { describe, expect, it } from "vitest";
import { toHsl, unitHsl } from "../../src/colour/hsl.js";
import { mirrorRgb } from "../../src/colour/background.js";
import { colourToHex } from "../../src/colour/colours.js";
import { adjust } from "../../src/colour/palette.js";
import { formatHex } from "../../src/colour/rgb.js";
import { THEMES } from "../../src/paint/catalogue.js";
import { derive } from "../../src/paint/derive.js";
import { BARE, OWN_FALLBACKS } from "../../src/paint/theme-model.js";

const PURPLE = { r: 147, g: 112, b: 219 };

describe("the two HSL readings share one home and keep their own arithmetic", () => {
  it("reads the same hue and lightness and a saturation apart in the last bit", () => {
    const unit = unitHsl(PURPLE);
    const khroma = toHsl(PURPLE);
    expect(unit.h * 360).toBe(khroma.h);
    expect(unit.l * 100).toBe(khroma.l);
    expect(unit.s * 100).not.toBe(khroma.s);
  });

  it("turns, mirrors and reads CSS colours to the bytes they always gave", () => {
    expect(formatHex(adjust(PURPLE, { h: -120 }))).toBe("#70DB93");
    expect(formatHex(mirrorRgb(PURPLE))).toBe("#47248F");
    expect(formatHex(mirrorRgb(PURPLE, "dark"))).toBe("#482491");
    expect(formatHex(mirrorRgb(PURPLE, "light"))).toBe("#47248F");
    expect(colourToHex("hsl(260, 60%, 65%)")).toBe("#9470db");
    expect(colourToHex("hsl(-100deg 60% 65% / 0.5)")).toBe("#4a386e");
  });
});

describe("a kind's own ink falls back on one generic ink, in the theme files and the kind's sheet alike", () => {
  const read = new Map<string, unknown>(
    Object.entries(derive({ nodeBorder: "#112233", lineColor: "#445566", primaryTextColor: "#778899", textColor: "#AABBCC", primaryBorderColor: "#DDEEFF" }))
  );
  for (const [own, generic] of Object.entries(OWN_FALLBACKS)) {
    it(`derives ${own} off ${generic}`, () => {
      expect(read.get(own)).toBe(read.get(generic));
    });
  }
});

describe("every coloured palette of this page's own is built on one base", () => {
  for (const name of ["terra", "neon", "amber", "phosphor", "gruvbox", "monokai", "dracula", "nord", "solarized"]) {
    it(`gives ${name} the gradient and leaves its label ground, lifeline and sequence inks to the terminal`, () => {
      const stated = THEMES.get(name)?.stated;
      expect(stated?.useGradient).toBe(true);
      expect([stated?.edgeLabelBackground, stated?.actorLineColor, stated?.signalColor, stated?.labelBoxBkgColor]).toEqual([BARE, BARE, BARE, BARE]);
    });
  }
});
