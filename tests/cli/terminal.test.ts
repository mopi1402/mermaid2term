import { describe, it, expect } from "vitest";
import { backgroundFromColorFgBg, parseOsc11, parseXColor } from "../../src/cli/terminal.js";
import { OSC11_QUERY } from "../../src/paint/escapes.js";

describe("an OSC 11 reply", () => {
  it("is the query with the colour where the question mark was, terminated by ST or by BEL", () => {
    expect(OSC11_QUERY).toBe("\x1b]11;?\x1b\\");
    expect(parseOsc11("\x1b]11;rgb:1e1e/1e1e/2e2e\x1b\\")).toBe("#1E1E2E");
    expect(parseOsc11("\x1b]11;rgb:ffff/ffff/ffff\x07")).toBe("#FFFFFF");
  });

  it("is nothing while the bytes are still arriving, and nothing where they hold no reply", () => {
    expect(parseOsc11("\x1b]11;rgb:1e1e/1e1e")).toBeUndefined();
    expect(parseOsc11("")).toBeUndefined();
    expect(parseOsc11("\x1b[?1;2c")).toBeUndefined();
  });
});

describe("an X colour spec", () => {
  it("scales a channel of any width to eight bits", () => {
    expect(parseXColor("rgb:f/0/8")).toBe("#FF0088");
    expect(parseXColor("rgb:ff/00/88")).toBe("#FF0088");
    expect(parseXColor("rgb:ffff/0000/8888")).toBe("#FF0088");
    expect(parseXColor("#fdf6e3")).toBe("#FDF6E3");
  });

  it("names nothing for anything else", () => {
    expect(parseXColor("rgb:1e1e/1e1e")).toBeUndefined();
    expect(parseXColor("cmyk:0/0/0/0")).toBeUndefined();
  });
});

describe("COLORFGBG", () => {
  it("reads the side off the LAST field, konsole's middle field included", () => {
    expect(backgroundFromColorFgBg("15;0")).toBe("dark");
    expect(backgroundFromColorFgBg("0;15")).toBe("light");
    expect(backgroundFromColorFgBg("15;default;0")).toBe("dark");
    expect(backgroundFromColorFgBg("0;default;7")).toBe("light");
    expect(backgroundFromColorFgBg("15;8")).toBe("dark");
  });

  it("says nothing where the variable is unset, empty or not a slot", () => {
    expect(backgroundFromColorFgBg(undefined)).toBeUndefined();
    expect(backgroundFromColorFgBg("")).toBeUndefined();
    expect(backgroundFromColorFgBg("15;")).toBeUndefined();
    expect(backgroundFromColorFgBg("15;default")).toBeUndefined();
  });
});
