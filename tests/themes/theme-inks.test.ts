import { describe, expect, it } from "vitest";
import { themeRgb } from "../../src/colour/colours.js";
import { getTheme } from "../../src/paint/catalogue.js";
import { frameStyle, loopLine, noteInks } from "../../src/paint/frames.js";
import { BARE } from "../../src/paint/theme-model.js";

// The inks `docs/divergences.md` decides for the terminal's sake, each where mermaid draws otherwise.
describe("a sequence block's frame is drawn faded over the page, where mermaid strokes it full", () => {
  it("mixes half of the participant's line, and of the label box's rim `.loopLine` takes, with the page", () => {
    expect(frameStyle(getTheme("neutral"))).toBe("#6A6A6A");
    expect(loopLine(getTheme("neutral"))).toBe("#6A6A6A");
    expect(frameStyle(getTheme("base"))).toBe("#776F5E");
  });

  it("mixes 0.65 of it on default and dark", () => {
    expect(frameStyle(getTheme("default"))).toBe("#60498E");
    expect(frameStyle(getTheme("dark"))).toBe("#858585");
  });
});

describe("a note whose theme names no rim is ruled off its own slab", () => {
  it("strokes the slab at 0.8 of its channels", () => {
    expect(noteInks(getTheme("neutral", { noteBorderColor: BARE })).rule).toBe("#525252");
  });
});

describe("a colour the terminal cannot blend", () => {
  it("lays an rgba over black", () => {
    expect(themeRgb("rgba(255,255,255,0.25)")).toEqual({ r: 64, g: 64, b: 64 });
  });

  it("drops the alpha of an eight-digit hex", () => {
    expect(themeRgb("#FFFFFF40")).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("a CSS colour name the terminal names too", () => {
  it("reads `red` as the terminal's red, not CSS's #FF0000", () => {
    expect(themeRgb("red")).toEqual({ r: 187, g: 0, b: 0 });
  });
});
