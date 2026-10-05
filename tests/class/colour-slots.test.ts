import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { paintedRowWith, stripSgr } from "../support/ansi.js";

// mermaid 12 under `redux-color` and `redux-dark-color` strokes each class box and its dividers with
// `borderColorArray[i]` and, where the theme states one, fills it with `bkgColorArray[i]`, `i` counting the classes in
// the order they are first named, a lollipop's interface left out (`colorIndex`).
const source = (direction: string): string =>
  [
    "classDiagram",
    `  direction ${direction}`,
    "  Z <|-- Y",
    "  class X {",
    "    +int x",
    "  }",
    "  Y --> X",
    "  bar ()-- W",
    "  class V",
    "  style V stroke:#ff0000",
    "  namespace N {",
    "    class U",
    "  }",
  ].join("\n");

const rgb = (hex: string): string => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(";");
const rowOf = (drawn: string, word: string): string => paintedRowWith(drawn, ` ${word} `);
// The ink a wall is drawn in, the class's ground standing under it.
const walled = (stroke: string, fill: string): RegExp => new RegExp(`38;2;${rgb(stroke)};48;2;${rgb(fill)}m│`, "u");

describe.each(["TB", "LR"])("a class diagram's boxes under mermaid 12's colour themes (%s)", (direction) => {
  const light = renderThemed(source(direction), { width: 120, background: "light" }, "redux-color");
  const dark = renderThemed(source(direction), { width: 120, background: "dark" }, "redux-dark-color");

  it("gives each class its slot's border and ground on `redux-color`, the lollipop skipped, its own `style` winning", () => {
    const slots: ReadonlyArray<readonly [string, string, string]> = [
      ["Z", "#E879F9", "#FDF4FF"],
      ["Y", "#2DD4BF", "#F0FDFA"],
      ["X", "#FB923C", "#FFF7ED"],
      ["W", "#22D3EE", "#ECFEFF"],
      ["V", "#FF0000", "#F0FDF4"],
      ["U", "#A78BFA", "#F5F3FF"],
    ];
    for (const [name, stroke, fill] of slots) {
      const row = rowOf(light, name);
      expect(row).toContain(`48;2;${rgb(fill)}m${name}`);
      expect(row).toMatch(walled(stroke, fill));
    }
    // The divider under X's name takes the slot's stroke too.
    expect(light).toContain(`38;2;${rgb("#FB923C")};48;2;${rgb("#FFF7ED")}m├`);
  });

  it("strokes them alone on `redux-dark-color`, the box on `mainBkg`, and lays the namespace on `clusterBkg`", () => {
    expect(rowOf(dark, "X")).toMatch(walled("#FB923C", "#111113"));
    expect(rowOf(light, "N")).toContain(`48;2;${rgb("#F9F9FB")}mN`);
  });

  it("leaves `redux` in its one border, on the same geometry", () => {
    const grey = renderThemed(source(direction), { width: 120, background: "light" }, "redux");
    expect(rowOf(grey, "X")).toMatch(walled("#28253D", "#FFFFFF"));
    expect(stripSgr(light)).toBe(stripSgr(grey));
  });
});
