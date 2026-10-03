import { describe, it, expect } from "vitest";
import {
  backgroundFromColorScheme,
  colourFromTerminalBackground,
  environmentGround,
  groundFromEnvironment,
  hostGround,
} from "../../src/paint/environment.js";
import { groundOf, renderThemedText } from "../../src/index.js";
import { GROUND_VARS } from "../../scripts/unasked.js";

describe("TERMINAL_BACKGROUND", () => {
  it("is the colour itself, in either case, and nothing where it is not a #rrggbb", () => {
    expect(colourFromTerminalBackground("#282C34")).toBe("#282C34");
    expect(colourFromTerminalBackground("#fdf6e3")).toBe("#fdf6e3");
    expect(colourFromTerminalBackground("282C34")).toBeUndefined();
    expect(colourFromTerminalBackground("#fff")).toBeUndefined();
    expect(colourFromTerminalBackground("dark")).toBeUndefined();
    expect(colourFromTerminalBackground(undefined)).toBeUndefined();
  });

  it("is a ground `groundOf` reads a side off", () => {
    expect(groundOf(groundFromEnvironment({ TERMINAL_BACKGROUND: "#282C34" }))?.side).toBe("dark");
    expect(groundOf(groundFromEnvironment({ TERMINAL_BACKGROUND: "#FDF6E3" }))?.side).toBe("light");
  });
});

describe("TERMINAL_COLOR_SCHEME", () => {
  it("names a side in any case, and nothing for any other word", () => {
    expect(backgroundFromColorScheme("dark")).toBe("dark");
    expect(backgroundFromColorScheme("Light")).toBe("light");
    expect(backgroundFromColorScheme(" DARK ")).toBe("dark");
    expect(backgroundFromColorScheme("auto")).toBeUndefined();
    expect(backgroundFromColorScheme("")).toBeUndefined();
    expect(backgroundFromColorScheme(undefined)).toBeUndefined();
  });
});

describe("the three together", () => {
  it("answers with the colour first, whatever the side variables say", () => {
    expect(environmentGround({ TERMINAL_BACKGROUND: "#FFFFFF", TERMINAL_COLOR_SCHEME: "dark", COLORFGBG: "15;0" })).toEqual({
      variable: "TERMINAL_BACKGROUND",
      value: "#FFFFFF",
    });
  });

  it("falls through to the scheme where the colour is absent or unreadable", () => {
    expect(environmentGround({ TERMINAL_COLOR_SCHEME: "light", COLORFGBG: "15;0" })).toEqual({ variable: "TERMINAL_COLOR_SCHEME", value: "light" });
    expect(environmentGround({ TERMINAL_BACKGROUND: "blue", TERMINAL_COLOR_SCHEME: "light" })).toEqual({ variable: "TERMINAL_COLOR_SCHEME", value: "light" });
  });

  it("reads COLORFGBG last, and only where the other two say nothing", () => {
    expect(environmentGround({ COLORFGBG: "0;15" })).toEqual({ variable: "COLORFGBG", value: "light" });
    expect(environmentGround({ TERMINAL_COLOR_SCHEME: "auto", COLORFGBG: "15;default;0" })).toEqual({ variable: "COLORFGBG", value: "dark" });
  });

  it("says nothing where no variable reads as a ground", () => {
    expect(environmentGround({})).toBeUndefined();
    expect(environmentGround({ TERMINAL_BACKGROUND: "nope", TERMINAL_COLOR_SCHEME: "auto", COLORFGBG: "default" })).toBeUndefined();
    expect(groundFromEnvironment({ PATH: "/usr/bin" })).toBeUndefined();
  });
});

describe("the host's ground", () => {
  const SOURCE = "flowchart TD\n  A --> B";
  const saved = { ...process.env };
  const restore = (): void => {
    for (const name of GROUND_VARS) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  };

  it("is read off process.env where the library is given no background", () => {
    try {
      process.env.TERMINAL_BACKGROUND = "#FFFFFF";
      delete process.env.TERMINAL_COLOR_SCHEME;
      const light = renderThemedText(SOURCE, {}, "classic").toAnsi();
      process.env.TERMINAL_BACKGROUND = "#000000";
      const dark = renderThemedText(SOURCE, {}, "classic").toAnsi();
      expect(hostGround()).toBe("#000000");
      expect(light).not.toBe(dark);
    } finally {
      restore();
    }
  });

  it("gives way to a stated background, whatever the variables say", () => {
    try {
      process.env.TERMINAL_BACKGROUND = "#FFFFFF";
      process.env.TERMINAL_COLOR_SCHEME = "light";
      const stated = renderThemedText(SOURCE, { background: "dark" }, "classic").toAnsi();
      delete process.env.TERMINAL_BACKGROUND;
      delete process.env.TERMINAL_COLOR_SCHEME;
      delete process.env.COLORFGBG;
      const plain = renderThemedText(SOURCE, { background: "dark" }, "classic").toAnsi();
      expect(stated).toBe(plain);
    } finally {
      restore();
    }
  });
});
