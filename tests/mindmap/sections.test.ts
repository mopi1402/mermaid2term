import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { renderThemed } from "../../src/index.js";
import { parseMindmap } from "../../src/diagrams/mindmap/parser.js";
import { renderMindmap } from "../../src/diagrams/mindmap/render.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { EDGE, SECTION_ROOT, elementKey } from "../../src/canvas/keys.js";
import { runOf } from "../support/ansi.js";

const SOURCE = "mindmap\n  root((Project))\n    Plan\n      Scope\n      Budget\n    Build\n      Code base\n      Tests\n    Ship\n    Learn\n      Retro\n";
const WIDE = 80;
const NARROW = 30;

// Every cell's key, row by row, as the canvas hands it to the painter.
const keysOf = (source: string, budget: number): Array<Array<readonly [string, string]>> =>
  renderMindmap(parseMindmap(source), UNICODE, true, budget).toStyledPairs();

const keyOfWord = (source: string, budget: number, word: string): string[] => {
  for (const row of keysOf(source, budget)) {
    const text = row.map(([ch]) => ch).join("");
    const at = text.indexOf(word);
    if (at !== -1) return [...new Set(row.slice(at, at + word.length).map(([, key]) => key))];
  }
  return [];
};

// The key of the connector glyph a word's line comes in by: beside it on its row, or over or under its middle.
const LINE_RE = /[─│┬┴┼├┤╭╮╰╯]/u;
const edgeBeside = (source: string, budget: number, word: string): string | undefined => {
  const cells = keysOf(source, budget);
  for (const [r, row] of cells.entries()) {
    const text = row.map(([ch]) => ch).join("");
    const at = text.indexOf(word);
    if (at === -1) continue;
    const middle = at + Math.floor(word.length / 2);
    const around = [row[at - 2], row[at + word.length + 1], cells[r - 1]?.[middle], cells[r + 1]?.[middle]];
    return around.find((cell) => cell !== undefined && LINE_RE.test(cell[0]))?.[1];
  }
  return undefined;
};

// The SGR parameters a word is written under in a themed drawing.
const sgrOf = (source: string, theme: string, background: "light" | "dark", word: string): string =>
  runOf(renderThemed(source, { width: WIDE, background }, theme), word);

const rgb = (hex: string): string => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(";");
const onGround = (hex: string): string => `48;2;${rgb(hex)}`;
const inInk = (hex: string): string => `38;2;${rgb(hex)}`;

describe("mindmap sections, as mermaid's `assignSections` and `genSections` number and fill them", () => {
  for (const budget of [WIDE, NARROW]) {
    it(`gives the root's child i the seat i % 11 + 1 and its whole subtree that seat (budget ${budget})`, () => {
      expect(keyOfWord(SOURCE, budget, "Project")).toEqual([elementKey(SECTION_ROOT, "circle")]);
      expect(keyOfWord(SOURCE, budget, "Plan")).toEqual(["section:1"]);
      expect(keyOfWord(SOURCE, budget, "Budget")).toEqual(["section:1"]);
      expect(keyOfWord(SOURCE, budget, "Code base")).toEqual(["section:2"]);
      expect(keyOfWord(SOURCE, budget, "Ship")).toEqual(["section:3"]);
      expect(keyOfWord(SOURCE, budget, "Retro")).toEqual(["section:4"]);
    });

    it(`strokes each edge in its child's section (budget ${budget})`, () => {
      expect(edgeBeside(SOURCE, budget, "Plan")).toBe("sectionfg:1");
      expect(edgeBeside(SOURCE, budget, "Scope")).toBe("sectionfg:1");
      expect(edgeBeside(SOURCE, budget, "Tests")).toBe("sectionfg:2");
      expect(edgeBeside(SOURCE, budget, "Retro")).toBe("sectionfg:4");
    });
  }

  it("leaves the trunk several sections share without a section of its own", () => {
    const source = "mindmap\n  Engine\n    Parser\n    Layout\n    Routing\n    Renderer\n    Themes\n    Tests\n    Docs\n    Packaging\n";
    const row = keysOf(source, WIDE).find((one) => one.map(([ch]) => ch).join("").includes("Engine")) ?? [];
    const text = row.map(([ch]) => ch).join("");
    expect(row[text.indexOf("Engine") + "Engine ".length]?.[1]).toBe(EDGE);
  });

  it("brings a colour back past eleven branches on the two facing each other across the root, never the root's seat 0", () => {
    const branches = Array.from({ length: 12 }, (_, at) => `    B${at + 10}`).join("\n");
    const source = `mindmap\n  Root\n${branches}\n`;
    const seats = Array.from({ length: 12 }, (_, at) => keyOfWord(source, WIDE, `B${at + 10}`)[0]);
    expect(new Set(seats)).toEqual(new Set(Array.from({ length: 11 }, (_, at) => `section:${at + 1}`)));
    expect(keyOfWord(source, WIDE, "B16")).toEqual(keyOfWord(source, WIDE, "B10"));
    expect(keyOfWord(source, WIDE, "B21")).toEqual(["section:11"]);
  });

  it("gives Search's colour to the branch across the root from it, not to the last one beside it", () => {
    const source = readFileSync("fixtures/mindmap/many-children.mmd", "utf8");
    expect(keyOfWord(source, 120, "Webhooks")).toEqual(keyOfWord(source, 120, "Search"));
    expect(keyOfWord(source, 120, "Localisation")).not.toEqual(keyOfWord(source, 120, "Search"));
  });
});

describe("mindmap colours, mermaid's own on its themes", () => {
  it("fills the root with `git0` under `gitBranchLabel0` and each branch with its `cScale` seat (default)", () => {
    expect(sgrOf(SOURCE, "default", "light", "Project")).toContain(`${inInk("#FFFFFF")};${onGround("#0000EC")}`);
    expect(sgrOf(SOURCE, "default", "light", "Plan")).toContain(onGround("#FFFF78"));
    expect(sgrOf(SOURCE, "default", "light", "Scope")).toContain(onGround("#FFFF78"));
    expect(sgrOf(SOURCE, "default", "light", "Build")).toContain(onGround("#D7FF86"));
  });

  it("reads the dark theme's own seats, the root on its grey `git0`", () => {
    expect(sgrOf(SOURCE, "dark", "dark", "Project")).toContain(onGround("#797D7D"));
    expect(sgrOf(SOURCE, "dark", "dark", "Plan")).toContain(onGround("#0B0000"));
    expect(sgrOf(SOURCE, "dark", "dark", "Build")).toContain(onGround("#4D1037"));
  });

  it("inks a redux root in `nodeBorder`, as `.section-root span` does there", () => {
    expect(sgrOf(SOURCE, "redux-dark", "dark", "Project")).toContain(`${inInk("#FFFFFF")};${onGround("#000000")}`);
    expect(sgrOf(SOURCE, "neo-dark", "dark", "Project")).toContain(`${inInk("#E0DFDF")};${onGround("#8B0000")}`);
  });

  it("lays a blank inside a label on the label's fill", () => {
    expect(sgrOf(SOURCE, "default", "light", "Code base")).toContain(onGround("#D7FF86"));
  });

  it("leaves no blank tail past the last glyph of a row", () => {
    for (const background of ["light", "dark"] as const) {
      for (const width of [40, WIDE, 120]) {
        const out = renderThemed(SOURCE, { width, background }, "default");
        for (const line of out.split("\n")) expect(line).not.toMatch(/ $/u);
      }
    }
  });
});
