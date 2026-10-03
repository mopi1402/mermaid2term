import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { paintedRowWith, stripSgr } from "../support/ansi.js";

// mermaid 12 under `redux-color` and `redux-dark-color` strokes each subgraph with `borderColorArray[i]` and, where the
// theme states one, fills it with `bkgColorArray[i]`, `i` counting the subgraphs parents first (`colorIndex`).
const source = (direction: string): string =>
  [
    `flowchart ${direction}`,
    "  subgraph S0",
    "    A --> B",
    "    subgraph S1",
    "      C",
    "    end",
    "  end",
    "  subgraph S2",
    "    D",
    "  end",
    "  subgraph S3",
    "    E",
    "  end",
    "  B --> D --> E",
  ].join("\n");

const fg = (hex: string): string => `38;2;${[1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(";")}`;
const bg = (hex: string): string => `48;2;${[1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(";")}`;
// The ink a glyph is drawn in, whatever ground stands under it.
const inked = (hex: string, glyph: string): RegExp => new RegExp(`${fg(hex)}(;48;2;[0-9;]+)?m${glyph}`, "u");

describe.each(["TD", "LR"])("a flowchart's subgraphs under mermaid 12's colour themes (%s)", (direction) => {
  const light = renderThemed(source(direction), { width: 100, background: "light" }, "redux-color");
  const dark = renderThemed(source(direction), { width: 100, background: "dark" }, "redux-dark-color");

  it("gives each subgraph its slot's border and ground on `redux-color`, in the order they open", () => {
    const slots: ReadonlyArray<readonly [string, string, string]> = [
      ["S0", "#E879F9", "#FDF4FF"],
      ["S1", "#2DD4BF", "#F0FDFA"],
      ["S2", "#FB923C", "#FFF7ED"],
      ["S3", "#22D3EE", "#ECFEFF"],
    ];
    for (const [name, stroke, fill] of slots) {
      const row = paintedRowWith(light, name);
      expect(row).toContain(`${bg(fill)}m${name}`);
      expect(row).toMatch(inked(stroke, "│"));
    }
  });

  it("strokes them alone on `redux-dark-color`, whose palette states no ground: the cluster keeps `clusterBkg`", () => {
    const row = paintedRowWith(dark, "S2");
    expect(row).toContain(`${fg("#FB923C")}m│`);
    expect(row).toContain(`${bg("#1E1A2E")}mS2`);
  });

  it("leaves `redux` in its one cluster border and lays the same geometry as the colour theme", () => {
    const grey = renderThemed(source(direction), { width: 100, background: "light" }, "redux");
    expect(paintedRowWith(grey, "S2")).toContain(`${fg("#28253D")}m│`);
    expect(grey).not.toContain(fg("#E879F9"));
    expect(stripSgr(light)).toBe(stripSgr(grey));
  });

  it("keeps an edge crossing a frame in its own ink, and a subgraph's own `style` over its slot", () => {
    const crossing = direction === "TD" ? must(light.split("\n").find((row) => stripSgr(row).includes("┌────│────┐"))) : paintedRowWith(light, " D ");
    expect(crossing).toContain(`${fg("#000000")}m${direction === "TD" ? "│" : "─────"}`);
    expect(crossing).not.toMatch(new RegExp(`${fg("#FB923C")}m${direction === "TD" ? "┌─*│" : "─"}`, "u"));
    const styled = renderThemed(`${source(direction)}\n  style S2 stroke:#FF0000`, { width: 100, background: "light" }, "redux-color");
    expect(paintedRowWith(styled, "S2")).toContain(`${fg("#FF0000")}m│`);
    expect(paintedRowWith(styled, "S2")).toContain(`${bg("#FFF7ED")}mS2`);
  });
});
