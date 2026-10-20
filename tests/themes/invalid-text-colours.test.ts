import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const body = (direction: string): string => `flowchart ${direction}\n  A[SECRET] --> B[other]\n`;
const written = (direction: string, key: string, value: string): string =>
  withConfig({ theme: "base", themeVariables: { [key]: value } }, body(direction));
const unwritten = (direction: string): string => withConfig({ theme: "base" }, body(direction));

// mermaid leaves a colour it cannot read unpainted: a word that names no colour is no style either.
describe("a themeVariables value naming no colour is ignored", () => {
  for (const direction of ["TD", "LR"]) {
    for (const key of ["primaryTextColor", "nodeTextColor", "textColor"]) {
      for (const value of ["conceal", "blink", "conceal blink reverse"]) {
        it(`${direction}, ${key}: ${value}`, () => {
          expect(renderThemed(written(direction, key, value), { width: 80 }, "default")).toBe(renderThemed(unwritten(direction), { width: 80 }, "default"));
        });
      }
    }

    it(`${direction}: currentColor and a stray code draw instead of throwing`, () => {
      for (const value of ["currentColor", "\"#000;8\""]) {
        expect(renderThemed(written(direction, "primaryTextColor", value), { width: 80 }, "default")).toBe(renderThemed(unwritten(direction), { width: 80 }, "default"));
      }
    });

    it(`${direction}: the init directive reads the same`, () => {
      const directive = `%%{init: {"themeVariables": {"nodeTextColor": "conceal"}}}%%\n${body(direction)}`;
      expect(renderThemed(directive, { width: 80 }, "default")).toBe(renderThemed(body(direction), { width: 80 }, "default"));
    });

    it(`${direction}: a palette keeps the colours it names alone`, () => {
      const chart = (palette: string): string =>
        withConfig({ themeVariables: { xyChart: { plotColorPalette: palette } } }, "xychart-beta\n  x-axis [a, b]\n  bar [1, 2]\n  line [2, 1]\n");
      expect(renderThemed(chart("\"conceal, #ff0000, blink\""), { width: 60 }, "default")).toBe(renderThemed(chart("\"#ff0000\""), { width: 60 }, "default"));
    });
  }
});
