import { describe, it, expect } from "vitest";
import { colourToHex } from "../../src/colour/colours.js";
import { parseHex } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";
import { derive } from "../../src/paint/derive.js";
import { themeVariablesFrom } from "../../src/paint/themes.js";
import { type InkName, type StatedVariables } from "../../src/paint/theme-model.js";

// Read off mermaid 12.0.0's `getThemeVariables` of `theme-base.js`, seeded as its constructor seeds it, as hex.
const SEEDS: StatedVariables = { background: "#F4F4F4", primaryColor: "#FFF4DD" };

const LIGHT: ReadonlyArray<readonly [InkName, string]> = [
  ["primaryTextColor", "#333333"], ["arrowheadColor", "#0B0B0B"], ["mainBkg", "#FFF4DD"], ["clusterBkg", "#F6F9FF"],
  ["clusterBorder", "#CFDBF3"], ["titleColor", "#090600"], ["nodeTextColor", "#333333"], ["classText", "#333333"],
  ["activationBkgColor", "#F4DDFF"], ["activationBorderColor", "#E3AAFF"], ["rowOdd", "#FFFFFF"], ["rowEven", "#FFFCF6"],
  ["sectionBkgColor", "#F6F9FF"], ["altSectionBkgColor", "#FFFFFF"], ["sectionBkgColor2", "#FFF4DD"], ["excludeBkgColor", "#EEEEEE"],
  ["taskBorderColor", "#EEDDBB"], ["activeTaskBorderColor", "#FFF4DD"], ["doneTaskBkgColor", "#D3D3D3"], ["doneTaskBorderColor", "#808080"],
  ["critBorderColor", "#FF8888"], ["critBkgColor", "#FF0000"], ["todayLineColor", "#FF0000"], ["vertLineColor", "#000080"],
  ["gridColor", "#D3D3D3"], ["taskTextColor", "#333333"], ["taskTextOutsideColor", "#333333"], ["taskTextDarkColor", "#333333"],
  ["taskTextClickableColor", "#003163"], ["noteBkgColor", "#FFF5AD"], ["noteTextColor", "#333333"], ["noteBorderColor", "#E4DB95"],
  ["secondaryBorderColor", "#DDBBEE"], ["tertiaryBorderColor", "#CFDBF3"], ["tertiaryTextColor", "#090600"], ["labelBackgroundColor", "#FFF4DD"],
  ["git0", "#FFCB5D"], ["git1", "#CB5DFF"], ["git2", "#77A3FF"], ["git3", "#FF7A5D"], ["git4", "#FF5D92"], ["git5", "#FF5DE3"],
  ["git6", "#92FF5D"], ["git7", "#5DFFCB"], ["gitInv0", "#0034A2"], ["gitInv3", "#0085A2"], ["gitInv7", "#A20034"],
  ["branchLabelColor", "#333333"], ["gitBranchLabel5", "#333333"], ["commitLabelColor", "#0B2200"], ["commitLabelBackground", "#F4DDFF"],
  ["tagLabelColor", "#333333"], ["tagLabelBackground", "#FFF4DD"], ["tagLabelBorder", "#EEDDBB"], ["pieTitleTextColor", "#333333"],
  ["pieLegendTextColor", "#333333"],
];

// The same file under `darkMode: true`.
const DARK: ReadonlyArray<readonly [InkName, string]> = [
  ["primaryTextColor", "#EEEEEE"], ["nodeTextColor", "#EEEEEE"], ["classText", "#EEEEEE"], ["rowOdd", "#FFECC3"], ["rowEven", "#FFE3AA"],
  ["clusterBorder", "#FFFFFF"], ["noteBorderColor", "#F9F7E6"], ["git3", "#FFFFFF"], ["gitInv3", "#000000"], ["tagLabelColor", "#EEEEEE"],
];

// khroma rounds its channels where this package truncates: a unit apart is the same colour.
const close = (ours: string | undefined, theirs: string): boolean => {
  const a = parseHex(colourToHex(must(ours)) ?? "");
  const b = must(parseHex(theirs));
  return a !== undefined && Math.abs(a.r - b.r) <= 1 && Math.abs(a.g - b.g) <= 1 && Math.abs(a.b - b.b) <= 1;
};

describe("derive falls back as `theme-base.js` does, in its order, each variable off the ones before it", () => {
  it.each(LIGHT)("derives %s as mermaid's base theme does", (name, theirs) => {
    expect(close(derive(SEEDS)[name], theirs), `${name}: ${String(derive(SEEDS)[name])}`).toBe(true);
  });

  it.each(DARK)("derives %s as mermaid's base theme does in dark mode", (name, theirs) => {
    const ours = derive({ ...SEEDS, darkMode: true })[name];
    expect(close(ours, theirs), `${name}: ${String(ours)}`).toBe(true);
  });

  it("labels a branch black in dark mode, as `branchLabelColor` falls back", () => {
    expect(derive({ ...SEEDS, darkMode: true }).gitBranchLabel2).toBe("black");
  });

  it("is off dark mode where nothing says it, as mermaid leaves `darkMode` unset", () => {
    expect(derive({}).darkMode).toBe(false);
  });

  it("shades a written git seat before it inverts it, and lays the written seat back over the shade", () => {
    const drawn = derive({ ...SEEDS, git3: "#3366CC" });
    expect(drawn.git3).toBe("#3366CC");
    expect(close(drawn.gitInv3, "#E6CC99")).toBe(true);
  });

  it("rims a tag with the `tagBorder` written, a written `tagLabelBorder` over it", () => {
    expect(derive({ ...SEEDS, tagBorder: "#123456" }).tagLabelBorder).toBe("#123456");
    expect(derive({ ...SEEDS, tagBorder: "#123456", tagLabelBorder: "#654321" }).tagLabelBorder).toBe("#654321");
  });
});

describe("the steps mermaid derives through, read off `themeVariables` like any other", () => {
  const read = (key: string, value: string): StatedVariables => themeVariablesFrom(new Map([["primaryColor", "#FFF4DD"], [key, value]]));

  it.each([
    ["secondaryBorderColor", "gradientStop"],
    ["tertiaryBorderColor", "clusterBorder"],
    ["tertiaryTextColor", "titleColor"],
    ["branchLabelColor", "gitBranchLabel4"],
    ["labelBackgroundColor", "labelBackgroundColor"],
    ["tagLabelBorder", "tagLabelBorder"],
  ] as const)("accepts %s and derives %s from it", (key, reaches) => {
    expect(derive(read(key, "#123456"))[reaches]).toBe("#123456");
  });

  it("reads a written `cScalePeer3` and `cScaleInv3` into their seats, the others derived", () => {
    const stated = themeVariablesFrom(new Map([["cScalePeer3", "#123456"], ["cScaleInv3", "#654321"]]));
    const drawn = derive(stated);
    expect(drawn.cScalePeer[3]).toBe("#123456");
    expect(drawn.cScaleInv[3]).toBe("#654321");
    expect(drawn.cScalePeer[2]).toBe(derive({}).cScalePeer[2]);
  });

  it("reads a seat by its exact name only, as mermaid's `cScale` + index lookup does", () => {
    const stated = themeVariablesFrom(new Map([["cScale3x", "#123456"], ["cScale03", "#123456"]]));
    expect(stated.cScale).toBeUndefined();
  });
});

describe("`darkMode` read as mermaid tests it, truthy, off the scalar its YAML reader makes", () => {
  const dark = (written: string): boolean | undefined => themeVariablesFrom(new Map([["darkMode", written]])).darkMode;

  it.each(["true", "True", "TRUE", "yes", "on", "1", "dark"])("turns dark mode on for %s", (written) => {
    expect(dark(written)).toBe(true);
  });

  it.each(["false", "False", "FALSE", "null", "~", "0", "0.0", "0x0", ""])("leaves it off for %j", (written) => {
    expect(dark(written)).toBe(false);
  });
});

describe("CSS colours as khroma reads them", () => {
  it.each([
    ["rgb(255 0 0)", "#ff0000"],
    ["rgba(0 0 255 / 100%)", "#0000ff"],
    ["hsl(0.5turn 100% 50%)", "#00ffff"],
    ["hsl(120deg, 100%, 50%)", "#00ff00"],
    ["hsl(200grad 100% 50%)", "#00ffff"],
    ["hsl(3.14159265rad 100% 50%)", "#00ffff"],
  ])("reads %s as %s", (written, hex) => {
    expect(colourToHex(written)).toBe(hex);
  });
});
