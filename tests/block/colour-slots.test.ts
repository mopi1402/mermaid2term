import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { paintedRowWith, stripSgr } from "../support/ansi.js";

// mermaid 12 under `redux-color` and `redux-dark-color` strokes each composite block with `borderColorArray[i]` and,
// where the theme states one, fills it with `bkgColorArray[i]`, `i` counting the composites parents first
// (`colorIndex`); a leaf block keeps the theme's own dress.
const SOURCE = [
  "block-beta",
  "  columns 3",
  "  block:g0[\"g0\"]",
  "    a",
  "  end",
  "  block:g1[\"g1\"]",
  "    c",
  "    block:g2[\"g2\"]",
  "      d",
  "    end",
  "  end",
  "  block:g3[\"g3\"]",
  "    e",
  "  end",
  "  a --> e",
].join("\n");

const rgb = (hex: string): string => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(";");
const rowOf = (drawn: string, word: string): string => paintedRowWith(drawn, ` ${word} `);

describe.each([80, 120])("a block diagram's composites under mermaid 12's colour themes (width %i)", (width) => {
  const light = renderThemed(SOURCE, { width, background: "light" }, "redux-color");
  const dark = renderThemed(SOURCE, { width, background: "dark" }, "redux-dark-color");

  it("gives each composite its slot's frame and ground on `redux-color`, a nested one standing on its parent's", () => {
    const slots: ReadonlyArray<readonly [string, string, string]> = [
      ["g0", "#E879F9", "#FDF4FF"],
      ["g1", "#2DD4BF", "#F0FDFA"],
      ["g2", "#FB923C", "#FFF7ED"],
      ["g3", "#22D3EE", "#ECFEFF"],
    ];
    for (const [name, stroke, fill] of slots) {
      const row = rowOf(light, name);
      expect(row).toContain(`48;2;${rgb(fill)}m${name}`);
      expect(row).toMatch(new RegExp(`38;2;${rgb(stroke)}(;48;2;[0-9;]+)?m│`, "u"));
    }
    expect(rowOf(light, "g2")).toContain(`38;2;${rgb("#FB923C")};48;2;${rgb("#F0FDFA")}m│`);
    // A leaf block keeps `mainBkg` inside and `nodeBorder` round it, on its composite's ground.
    expect(rowOf(light, "a")).toContain(`38;2;${rgb("#28253D")};48;2;${rgb("#FDF4FF")}m│`);
    expect(rowOf(light, "a")).toContain(`48;2;${rgb("#FFFFFF")}ma`);
  });

  it("strokes them alone on `redux-dark-color`, whose palette states no ground", () => {
    const row = rowOf(dark, "g3");
    expect(row).toContain(`38;2;${rgb("#22D3EE")}m│`);
    expect(row).not.toContain(`48;2;${rgb("#ECFEFF")}`);
  });

  it("keeps an edge crossing a composite's frame in its own ink, and `redux` in its one frame colour, on the same geometry", () => {
    const edge = must(light.split("\n").find((row) => /│\s+┌─/u.test(stripSgr(row))));
    expect(stripSgr(edge)).not.toContain("┼");
    expect(edge).not.toMatch(new RegExp(`38;2;(${rgb("#E879F9")}|${rgb("#22D3EE")})(;48;2;[0-9;]+)?m[^│\u001b]*─`, "u"));
    const grey = renderThemed(SOURCE, { width, background: "light" }, "redux");
    expect(grey).not.toContain(rgb("#E879F9"));
    expect(stripSgr(light)).toBe(stripSgr(grey));
  });
});
