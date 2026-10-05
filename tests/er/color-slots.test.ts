import { describe, it, expect } from "vitest";
import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { SGR_RE } from "../support/ansi.js";

// Thirteen entities, one past the twelve slots of `borderColorArray`, the last wrapping back on the first.
const NAMES = ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10", "E11", "E12"];
const source = (direction: string): string =>
  `erDiagram\n  direction ${direction}\n  E0 {\n    int id PK\n    string name\n  }\n` +
  NAMES.slice(1).map((name, i) => `  ${NAMES[i]} ||--o{ ${name} : has`).join("\n") + "\n  style E2 stroke:#ff0000\n";

const rows = (direction: string, theme: string): string[] =>
  renderThemed(source(direction), { width: 400, background: theme.includes("dark") ? "dark" : "light" }, theme)
    .replace(SGR_RE, (_, params: string) => (params === "0" ? "" : `<${params}>`))
    .split("\n");

// The row naming an entity, where its left wall stands just before its padding.
const nameRow = (drawn: string[], name: string): string => must(drawn.find((row) => new RegExp(`>${name}<`, "u").test(row)));
const walled = (row: string, ink: string): boolean => [..."│├┤"].some((wall) => row.includes(`<${ink}>${wall}`));

// mermaid 12, measured: `redux-color` strokes entity i in `borderColorArray[i % 12]` and fills every rect of it in
// `bkgColorArray[i % 12]`; `redux-dark-color` has no tint and keeps `mainBkg`.
describe("an ER entity takes its colour slot under the redux colour themes", () => {
  for (const direction of ["TB", "LR"]) {
    it(`strokes and tints each entity by its order, ${direction}`, () => {
      const drawn = rows(direction, "redux-color");
      expect(walled(nameRow(drawn, "E0"), "38;2;232;121;249;48;2;253;244;255")).toBe(true);
      expect(drawn.some((row) => row.includes("<38;2;232;121;249;48;2;253;244;255>├"))).toBe(true);
      expect(drawn.some((row) => row.includes("<48;2;253;244;255> <38;2;40;37;61;48;2;253;244;255>string"))).toBe(true);
      expect(walled(nameRow(drawn, "E1"), "38;2;45;212;191;48;2;240;253;250")).toBe(true);
      expect(walled(nameRow(drawn, "E2"), "38;2;255;0;0;48;2;255;247;237")).toBe(true);
      expect(walled(nameRow(drawn, "E11"), "38;2;251;113;133;48;2;255;241;242")).toBe(true);
      expect(walled(nameRow(drawn, "E12"), "38;2;232;121;249;48;2;253;244;255")).toBe(true);
    });

    it(`strokes each entity alone on the dark colour theme, ${direction}`, () => {
      const drawn = rows(direction, "redux-dark-color");
      expect(walled(nameRow(drawn, "E0"), "38;2;232;121;249;48;2;17;17;19")).toBe(true);
      expect(walled(nameRow(drawn, "E1"), "38;2;45;212;191;48;2;17;17;19")).toBe(true);
    });

    it(`keeps one stroke on the plain redux themes, ${direction}`, () => {
      expect(walled(nameRow(rows(direction, "redux"), "E1"), "38;2;40;37;61;48;2;255;255;255")).toBe(true);
      expect(walled(nameRow(rows(direction, "redux-dark"), "E1"), "38;2;255;255;255;48;2;17;17;19")).toBe(true);
    });
  }
});
