import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";
import { type BorderMode } from "../../src/options.js";
import { type PaintedCell, paintedGrid } from "../support/grid.js";

const MODES: readonly BorderMode[] = ["default", "padless"];
const FILL = "#553300";
const STROKE = "#ff0000";
const COLOR = "#00ff00";

const grid = (source: string, borders: BorderMode): PaintedCell[][] =>
  paintedGrid(renderThemedText(source, { width: 100, borders }, "dracula").toAnsi());

const textOf = (row: readonly PaintedCell[]): string => row.map(({ ch }) => ch).join("");

const lastInked = (rows: readonly PaintedCell[][]): PaintedCell[] => [...rows].reverse().find((row) => row.some(({ ch }) => ch !== " ")) ?? [];

const source = (direction: string, dressing: string): string => `stateDiagram-v2
  direction ${direction}
  state Outer {
    A --> B
  }
  ${dressing}`;

const CLASSED = "classDef hot fill:#553300,stroke:#ff0000,color:#00ff00\n  class Outer hot";
const STYLED = "style Outer fill:#553300,stroke:#ff0000,color:#00ff00";

describe("a class on a composite state, as mermaid lays it on the rects of roundedWithTitle", () => {
  for (const direction of ["TB", "LR"]) {
    for (const borders of MODES) {
      const named = `${direction}, ${borders}`;

      it(`fills the body, not the name's band, and inks the name, ${named}`, () => {
        const rows = grid(source(direction, CLASSED), borders);
        const title = rows.findIndex((row) => textOf(row).includes("Outer"));
        const name = rows[title][textOf(rows[title]).indexOf("Outer")];
        expect(name.ink).toBe(COLOR);
        expect(name.ground).not.toBe(FILL);
        const body = rows.findIndex((row) => textOf(row).includes("A"));
        expect(rows.slice(title + 2, body).some((row) => row.some(({ ch, ground }) => ch === " " && ground === FILL))).toBe(true);
      });

      it(`strokes the body's outline alone, the lid keeping the theme's, ${named}`, () => {
        const rows = grid(source(direction, CLASSED), borders);
        const title = rows.findIndex((row) => textOf(row).includes("Outer"));
        const lid = lastInked(rows.slice(0, title));
        expect(lid.some(({ ink }) => ink === STROKE)).toBe(false);
        const floor = lastInked(rows);
        expect(floor.some(({ ink }) => ink === STROKE)).toBe(true);
      });

      it(`takes nothing from a style line, which mermaid never lays on a composite, ${named}`, () => {
        const rows = grid(source(direction, STYLED), borders);
        expect(rows.flat().some(({ ink, ground }) => ink === STROKE || ink === COLOR || ground === FILL)).toBe(false);
      });
    }
  }
});

describe("a class's dashes and weight on a composite, its divider included as the lid of mermaid's inner rect", () => {
  for (const direction of ["TB", "LR"]) {
    it(`dashes the walls, the lid and the divider, ${direction}`, () => {
      const lines = render(source(direction, "classDef hot stroke-dasharray:5 5\n  class Outer hot"), { width: 100 }).split("\n");
      const title = lines.findIndex((line) => line.includes("Outer"));
      expect(lines[title].trim()[0]).toBe("╵");
      expect(lines[title - 1]).toContain("─ ─");
      expect(lines[title + 1]).toMatch(/^├─ ─.*─┤$/u);
    });

    it(`weighs the divider on every arm, ${direction}`, () => {
      const lines = render(source(direction, "classDef hot stroke-width:4px\n  class Outer hot"), { width: 100 }).split("\n");
      const title = lines.findIndex((line) => line.includes("Outer"));
      expect(lines[title + 1]).toMatch(/^┣━+┫$/u);
    });
  }
});

describe("a rounded box's dashes and weight", () => {
  const cases: ReadonlyArray<readonly [string, (direction: string) => string]> = [
    ["a state", (direction) => `stateDiagram-v2\n  direction ${direction}\n  A --> B\n  style A stroke-dasharray:5 5\n  style B stroke-width:4px`],
    ["a flowchart round node", (direction) => `flowchart ${direction}\n  A(one) --> B(two)\n  style A stroke-dasharray:5 5\n  style B stroke-width:4px`],
  ];
  for (const [kind, drawn] of cases) {
    for (const direction of ["TB", "LR"]) {
      it(`reach its sides, whose corners are arcs, ${kind}, ${direction}`, () => {
        const text = render(drawn(direction), { width: 100 });
        expect(text).toContain("╭─ ─");
        expect(text).toContain("╵");
        expect(text).toContain("━━━");
        expect(text).toContain("┃");
      });
    }
  }
});
