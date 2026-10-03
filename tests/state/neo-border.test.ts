import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIGHT_BACKGROUND, renderThemedText } from "../../src/index.js";

// `#1971c2` as the terminal receives it.
const BLUE = "38;2;25;113;194";

const source = (theme: string, direction: string): string =>
  `---\nconfig:\n  theme: ${theme}\n  themeVariables:\n    nodeBorder: "#1971c2"\n    useGradient: false\n---\n` +
  `stateDiagram-v2\n    direction ${direction}\n    Draft --> Placed\n`;

const topWall = (theme: string, direction: string): string =>
  renderThemedText(source(theme, direction), { width: 80, background: LIGHT_BACKGROUND })
    .toAnsi()
    .split("\n")
    .find((row) => /[┌╭]/u.test(row)) ?? "";

describe("a state's wall under the `neo` look, stroked `nodeBorder` as `[data-look=\"neo\"].node rect` strokes it", () => {
  for (const direction of ["TB", "LR"]) {
    it(`takes the written nodeBorder over the theme's own stateBorder under ${direction}`, () => {
      expect(topWall("neo", direction)).toContain(BLUE);
    });

    it(`keeps nodeBorder under the classic look as well under ${direction}`, () => {
      expect(topWall("default", direction)).toContain(BLUE);
    });
  }
});

// What mermaid 12 draws once a stateBorder reaches its sheet (through `initialize`, probed 2026-10-18): a written one
// is honoured, over the theme's own, the box still `nodeBorder` under `neo`; `docs/divergences.md` for the source.
type Cell = { readonly ch: string; readonly style: string; readonly owner?: string };
const inkOf = (style: string | undefined): string | undefined => {
  const words = (style ?? "").split(/\s+/u);
  return words.find((word, at) => /^#[0-9a-f]{6}$/iu.test(word) && words[at - 1] !== "on")?.toLowerCase();
};
const WALL = /[│╭╮╰╯┌┐└┘]/u;
const cellsOf = (text: string): Cell[] => renderThemedText(text, { width: 80, background: LIGHT_BACKGROUND }).rows.flat();
const wallInk = (cells: Cell[], owner: string): string | undefined =>
  inkOf(cells.find((cell) => cell.owner?.startsWith(owner) === true && WALL.test(cell.ch))?.style);

const strokes = (theme: string, look: string, stateBorder: boolean, direction: string): { box: string | undefined; frame: string | undefined } => {
  const cells = cellsOf(
    `---\nconfig:\n  theme: ${theme}\n  look: ${look}\n  themeVariables:\n    nodeBorder: "#1971c2"\n    useGradient: false\n` +
      `${stateBorder ? '    stateBorder: "#e03131"\n' : ""}---\n` +
      `stateDiagram-v2\n  direction ${direction}\n  A --> B\n  state C {\n    D --> E\n  }\n  B --> C\n`,
  );
  return { box: wallInk(cells, "node"), frame: wallInk(cells, "subgraph") };
};

const PROBED: ReadonlyArray<readonly [theme: string, look: string, stateBorder: boolean, box: string, frame: string]> = [
  ["default", "classic", true, "#e03131", "#e03131"],
  ["default", "classic", false, "#1971c2", "#1971c2"],
  ["default", "neo", true, "#1971c2", "#e03131"],
  ["neo", "classic", true, "#e03131", "#e03131"],
  ["neo", "classic", false, "#000000", "#000000"],
  ["neo", "neo", true, "#1971c2", "#e03131"],
  ["neo", "neo", false, "#1971c2", "#000000"],
  ["neutral", "classic", false, "#000000", "#000000"],
  ["neutral", "neo", true, "#1971c2", "#e03131"],
];

describe.each(["TB", "LR"])("a state's wall and a composite's frame as mermaid's sheet strokes them (%s)", (direction) => {
  for (const [theme, look, written, box, frame] of PROBED) {
    it(`${theme}, ${look}, stateBorder ${written ? "written" : "unwritten"}`, () => {
      expect(strokes(theme, look, written, direction)).toEqual({ box, frame });
    });
  }

  // fixtures/state/frontmatter.mmd: `neo`, nodeBorder written and no stateBorder, its boxes blue as mermaid draws them.
  it("the fixture's own source strokes its boxes nodeBorder", () => {
    const fixture = readFileSync(new URL("../../fixtures/state/frontmatter.mmd", import.meta.url), "utf8");
    const cells = cellsOf(fixture.replace("stateDiagram-v2\n", `stateDiagram-v2\n    direction ${direction}\n`));
    const walls = cells.filter((cell) => cell.owner?.startsWith("node") === true && WALL.test(cell.ch));
    expect(walls.length).toBeGreaterThan(0);
    expect(new Set(walls.map((cell) => inkOf(cell.style)))).toEqual(new Set(["#1971c2"]));
  });
});
