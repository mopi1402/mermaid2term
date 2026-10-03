import { describe, it, expect } from "vitest";
import { renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { SGR_RE } from "../support/ansi.js";

// A nests B, C is styled by the source and so keeps no slot yet spends one, D takes the fourth, E's regions share E's.
const source = (direction: string): string =>
  `stateDiagram-v2\n  direction ${direction}\n  state A {\n    state B {\n      b1 --> b2\n    }\n    a1 --> B\n  }\n` +
  "  state C {\n    c1 --> c2\n  }\n  state D {\n    d1 --> d2\n  }\n  state E {\n    e1 --> e2\n    --\n    e3 --> e4\n  }\n" +
  "  classDef hot fill:#f00\n  class C hot\n  A --> C\n  C --> D\n  D --> E\n";

const drawn = (direction: string, theme: string): string =>
  renderThemed(source(direction), { width: 200, background: theme.includes("dark") ? "dark" : "light" }, theme).replace(
    SGR_RE,
    (_, params: string) => (params === "0" ? "" : `<${params}>`)
  );

// The ink of the wall a composite's name stands next to, on the row that names it.
const wallInk = (text: string, name: string): string => {
  const row = must(text.split("\n").find((line) => line.includes(`>${name}<`)));
  const walls = [...row.slice(0, row.indexOf(`>${name}<`)).matchAll(/<([0-9;]+)>│/gu)];
  return must(walls[walls.length - 1])[1];
};

// mermaid 12, measured: `redux-color` strokes a composite's rects in `borderColorArray[slot]` and fills its name's band
// and a region in `bkgColorArray[slot]`; `redux-dark-color` has no tint and keeps its grounds.
describe("a composite state takes its colour slot under the redux colour themes", () => {
  for (const direction of ["TB", "LR"]) {
    it(`slots composites in the order they open, ${direction}`, () => {
      const text = drawn(direction, "redux-color");
      expect(wallInk(text, "A")).toBe("38;2;232;121;249");
      expect(wallInk(text, "B")).toContain("38;2;45;212;191");
      expect(wallInk(text, "C")).toContain("38;2;40;37;61");
      expect(wallInk(text, "D")).toBe("38;2;34;211;238");
      expect(wallInk(text, "E")).toBe("38;2;74;222;128");
      expect(text).toContain("<1;38;2;40;37;61;48;2;253;244;255>A<48;2;253;244;255>");
      expect(text).toContain("<1;38;2;40;37;61;48;2;236;254;255>D<48;2;236;254;255>");
      expect(text).toMatch(/<38;2;232;121;249>├<38;2;232;121;249;48;2;253;244;255>─+<38;2;232;121;249>┤/u);
      expect(text).toContain("<38;2;74;222;128;48;2;255;255;255>┌┄");
      expect(text).toMatch(/<38;2;74;222;128;48;2;255;255;255>┊<48;2;240;253;244> /u);
    });

    it(`strokes composites alone on the dark colour theme, ${direction}`, () => {
      const text = drawn(direction, "redux-dark-color");
      expect(wallInk(text, "A")).toBe("38;2;232;121;249");
      expect(wallInk(text, "D")).toBe("38;2;34;211;238");
      expect(text).toContain("<1;38;2;224;223;223;48;2;17;17;19>A<48;2;17;17;19>");
    });

    it(`keeps one stroke on the plain redux themes, ${direction}`, () => {
      expect(wallInk(drawn(direction, "redux"), "D")).toBe("38;2;40;37;61");
      expect(wallInk(drawn(direction, "redux-dark"), "D")).toBe("38;2;255;255;255");
    });
  }
});
