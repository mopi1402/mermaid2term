import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";

// mermaid 12's `drawActivation`, measured headless on 2026-09-29: under `redux-color` and `redux-dark-color` a bar is
// stroked in its participant's `borderColorArray` seat and filled from `bkgColorArray`, or `mainBkg` where the theme
// states none; `redux` keeps `activationBorderColor`.
const SOURCE = "sequenceDiagram\n  participant A\n  participant B\n  participant C\n  participant D\n  A->>+B: one\n  B->>+B: again\n  B->>+D: two\n  D-->>-B: back\n  B-->>-A: done\n  B-->>-A: over";

const stylesOf = (theme: string, width: number, owner: string): string[] => {
  const background = theme.includes("dark") ? "dark" : "light";
  const cells = renderThemedText(SOURCE, { width, background }, theme).rows.flat();
  return [...new Set(cells.filter((cell) => cell.owner === owner && cell.ch.trim() !== "").map((cell) => cell.style))];
};

describe.each([60, 100])("a sequence activation under mermaid's colour themes, at width %i", (width) => {
  it.each(["redux-color", "redux-dark-color"])("strokes each bar in its participant's seat under %s", (theme) => {
    expect(stylesOf(theme, width, "active:1")).toEqual(["#2DD4BF"]);
    expect(stylesOf(theme, width, "active:3")).toEqual(["#22D3EE"]);
  });

  it("grounds a stacked bar's count on the participant's bkgColorArray seat, or on mainBkg", () => {
    expect(stylesOf("redux-color", width, "active_mark:1")).toEqual(["#28253D on #F0FDFA"]);
    expect(stylesOf("redux-dark-color", width, "active_mark:1")).toEqual(["#CCCCCC on #111113"]);
  });

  it("keeps activationBorderColor under redux", () => {
    expect(stylesOf("redux", width, "active:1")).toEqual(["#B3B3B3"]);
    expect(stylesOf("redux", width, "active:3")).toEqual(["#B3B3B3"]);
  });
});
