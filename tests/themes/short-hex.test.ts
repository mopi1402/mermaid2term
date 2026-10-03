import { describe, expect, it } from "vitest";
import { parseHex } from "../../src/colour/rgb.js";
import { mirrorDefinition, styleCodes } from "../../src/paint/sgr.js";

describe("a short hex, #rgb, as CSS and mermaid read it", () => {
  it("reads each digit doubled", () => {
    expect(parseHex("#333")).toEqual({ r: 51, g: 51, b: 51 });
    expect(parseHex("#F80")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("is emitted as the long form is, where it threw", () => {
    expect(styleCodes("#f80 on #333")).toBe(styleCodes("#ff8800 on #333333"));
  });

  it("is turned for a light ground as the long form is", () => {
    expect(mirrorDefinition("#333", "light")).toBe(mirrorDefinition("#333333", "light"));
  });

  it("still refuses what is neither", () => {
    for (const text of ["#33", "#3333", "333", "#ggg"]) expect(parseHex(text)).toBeUndefined();
  });
});
