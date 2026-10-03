import { describe, expect, it } from "vitest";
import { BRIGHT_FIRST, STANDARD_COLORS, colourRange, colourValue, formatHex, parseHex } from "../../src/colour/rgb.js";

describe("a hex colour is read and written as #rrggbb", () => {
  it("reads the three channels and writes them back upper case", () => {
    expect(parseHex("#ff8000")).toEqual({ r: 255, g: 128, b: 0 });
    expect(formatHex({ r: 255, g: 128, b: 0 })).toBe("#FF8000");
  });
  it("reads a short hex each digit doubled, and no bare word", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("red")).toBeUndefined();
  });
});

describe("a colour word is worth a value, or nothing", () => {
  it("weighs a standard name at the value a terminal draws it", () => {
    expect(colourValue("yellow")).toEqual({ r: 0xbb, g: 0xbb, b: 0 });
    expect(colourValue("#010203")).toEqual({ r: 1, g: 2, b: 3 });
    expect(colourValue("bold")).toBeUndefined();
  });
  it("gives a name its plain and bright ends, a hex itself alone, a stranger nothing", () => {
    expect(colourRange("magenta")).toHaveLength(2);
    expect(colourRange("bright_magenta")).toEqual(colourRange("magenta"));
    expect(colourRange("#010203")).toEqual([{ r: 1, g: 2, b: 3 }]);
    expect(colourRange("on")).toEqual([]);
  });
  it("keeps the sixteen names in two rows of eight", () => {
    expect(STANDARD_COLORS).toHaveLength(BRIGHT_FIRST * 2);
    expect(STANDARD_COLORS[BRIGHT_FIRST]).toBe("bright_black");
  });
});
