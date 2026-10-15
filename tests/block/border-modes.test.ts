import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";
import { DOWN_STROKES, armsOf } from "../../src/canvas/alphabet.js";
import { NONE } from "../../src/canvas/arms.js";
import { must } from "../../src/must.js";
import { type BorderMode } from "../../src/options.js";
import { gridOf, type Cell } from "../support/grid.js";

// The kinds drawn outside the graph engine follow the border mode as its nodes do: padless moves an outline onto its
// cells' edges in eighth blocks, borderless lays a box as a half-block slab of its ground where a theme lays one.
const plain = (source: string, borders: BorderMode): string[] => render(source, { width: 80, borders }).split("\n");
const themed = (source: string, borders: BorderMode): Cell[][] => gridOf(renderThemedText(source, { width: 80, borders }, "dracula"));
const glyphs = (row: readonly Cell[]): string => row.map(({ ch }) => ch).join("");
const rowWith = (grid: Cell[][], word: string): Cell[] => must(grid.find((row) => glyphs(row).includes(word)), word);
const BOX_CORNERS = /[┌┐└┘╭╮╰╯]/u;
const [LEFT_ARM, RIGHT_ARM, UP_ARM, DOWN_ARM] = [0, 1, 2, 3];

const BLOCKS = "block-beta\n  columns 2\n  a b\n  space c\n  a --> b\n  c --> b\n";
const LONE_BLOCKS = "block-beta\n  columns 2\n  one two\n";
const GROUPED = "block-beta\n  block:g[\"Group\"]\n    inner\n  end\n";
const BOARD = "kanban\n  todo[Todo]\n    t1[Write it]@{ priority: 'High' }\n    t2[Ship it]\n";
const JOURNEY = "journey\n  section Morning\n    Wake up: 5: Me\n    Coffee: 3: Me\n";
const PACKET = "packet-beta\n  0-7: \"Version\"\n  8-15: \"Length\"\n";

describe("a block follows the border mode as the flowchart node of its shape does", () => {
  it("closes an unlinked block's rules on its name under padless, its walls on their inner edge", () => {
    const rows = plain(LONE_BLOCKS, "padless");
    expect(rows[0]).toMatch(/^▕▔+▏\s+▕▔+▏$/u);
    expect(must(rows.find((row) => row.includes("one")))).toMatch(/^▕\s+one\s+▏\s+▕\s+two\s+▏$/u);
    expect(rows.join("\n")).not.toMatch(BOX_CORNERS);
  });

  it("keeps a block met on its walls on the outer edge, and brings a head beside an inner-edged wall onto it", () => {
    const rows = plain(BLOCKS, "padless");
    const met = must(rows.find((row) => row.includes("a") && row.includes("b")));
    // `a` meets its link on a wall: its walls stay on their outer edge. `b` meets one on a wall and one on a rule, so
    // its walls close on its name and the head takes the wall's cell, touching the eighth inside it.
    expect(met).toMatch(/^▏\s+a\s+▕─+⏵▏\s+b\s+▏$/u);
    expect(rows.join("\n")).not.toMatch(/⏵▕|▏⏴/u);
    expect(rows.join("\n")).not.toMatch(BOX_CORNERS);
  });

  it.each([40, 80])("keeps a link whole where its head moves onto a wall, straight on or turning, at %i columns", (width) => {
    const grid = render(readFileSync("fixtures/block/detours.mmd", "utf8"), { width, borders: "padless" }).split("\n").map((line) => [...line]);
    const armed = (r: number, c: number, arm: number): boolean => (armsOf(grid[r]?.[c] ?? " ")?.[arm] ?? NONE) !== NONE;
    // The cell beside a head reaches it, and goes on to the stroke it came from: straight, over a line it crosses, or
    // turning up or down.
    const goesOn = (r: number, c: number, away: -1 | 1): boolean =>
      (armed(r, c, away < 0 ? LEFT_ARM : RIGHT_ARM) && (armed(r, c + away, away < 0 ? RIGHT_ARM : LEFT_ARM) || DOWN_STROKES.has(grid[r][c + away] ?? " "))) ||
      (armed(r, c, UP_ARM) && armed(r - 1, c, DOWN_ARM)) ||
      (armed(r, c, DOWN_ARM) && armed(r + 1, c, UP_ARM));
    grid.forEach((row, r) =>
      row.forEach((glyph, c) => {
        if (glyph === "⏵") expect(armed(r, c - 1, RIGHT_ARM) && goesOn(r, c - 1, -1), row.join("")).toBe(true);
        if (glyph === "⏴") expect(armed(r, c + 1, LEFT_ARM) && goesOn(r, c + 1, 1), row.join("")).toBe(true);
      })
    );
  });

  it("grounds the cells a padless outline inks on their outer edge, and the page past an inner-edged one", () => {
    const row = rowWith(themed(LONE_BLOCKS, "padless"), "one");
    const wall = glyphs(row).indexOf("▕");
    const inside = row[wall + 1].ground;
    expect(inside).not.toBe("");
    expect(row[wall].ground).toBe("");
    const lid = themed(LONE_BLOCKS, "padless")[0];
    expect(lid[wall + 1].ch).toBe("▔");
    expect(lid[wall + 1].ground).toBe(inside);
  });

  it("moves a composite's frame onto its cells' edges under padless, its walls on the outer edge", () => {
    const rows = plain(GROUPED, "padless");
    expect(rows[0]).toMatch(/^▁+$/u);
    expect(must(rows.find((row) => row.includes("Group")))).toMatch(/^▏\s+Group\s+▕$/u);
    expect(must(rows.at(-1))).toMatch(/^▔+$/u);
  });

  it("lays a block as a slab of its fill under borderless where a theme fills it, and keeps its outline where none does", () => {
    const grid = themed(LONE_BLOCKS, "borderless");
    expect(glyphs(grid[0])).toMatch(/^▗▄+▖\s+▗▄+▖$/u);
    expect(glyphs(must(grid.at(-1)))).toMatch(/^▝▀+▘\s+▝▀+▘$/u);
    expect(plain(LONE_BLOCKS, "borderless")).toEqual(plain(LONE_BLOCKS, "default"));
  });
});

describe("a kanban board follows the border mode as a treemap's boxes do", () => {
  it("moves a column's outline and a card's onto their cells' edges under padless, the rules on the ground outside", () => {
    const grid = themed(BOARD, "padless");
    const page = grid[0];
    expect(glyphs(page)).toMatch(/^ ▁+$/u);
    expect(page.every(({ ground }) => ground === "")).toBe(true);
    const card = rowWith(grid, "Ship it");
    const column = card[0].ground;
    const cardWall = glyphs(card).indexOf("▏", 1);
    expect(card[cardWall].ground).not.toBe(column);
    const cardLid = grid[grid.indexOf(card) - 1];
    expect(cardLid[cardWall].ch).toBe("▁");
    expect(cardLid[cardWall].ground).toBe(column);
    expect(glyphs(rowWith(grid, "Todo"))).toMatch(/^◜\s+Todo\s+◝$/u);
    // A priority stays the card's left border, heavy, on the card's own ground.
    expect(glyphs(rowWith(grid, "Write it"))).toMatch(/^▏ ▌Write it▕ ▕$/u);
  });

  it("lays columns and cards as slabs under borderless where a theme fills them, a priority card keeping its outline", () => {
    const grid = themed(BOARD, "borderless");
    expect(glyphs(grid[0])).toMatch(/^ ▄+$/u);
    expect(glyphs(rowWith(grid, "Ship it"))).toMatch(/^▐ ▐Ship it\s*▌ ▌$/u);
    expect(glyphs(rowWith(grid, "Write it"))).toMatch(/^▐ ┃Write it│ ▌$/u);
    expect(plain(BOARD, "borderless")).toEqual(plain(BOARD, "default"));
  });
});

describe("a journey follows the border mode as a box met on its walls does", () => {
  it("moves a task's outline onto its cells' edges under padless, the line through the tasks touching its walls", () => {
    const rows = plain(JOURNEY, "padless");
    expect(must(rows.find((row) => row.includes("Wake up")))).toMatch(/─▏ Wake up ▕─▏ Coffee ▕─/u);
    expect(must(rows.find((row) => row.includes("Morning")))).toMatch(/^ ▁+ Morning ▁+$/u);
    expect(rows.join("\n")).not.toMatch(BOX_CORNERS);
  });

  it("lays a task as a slab of its band under borderless, and a header as its band alone, where a theme lays them", () => {
    const grid = themed(JOURNEY, "borderless");
    expect(glyphs(rowWith(grid, "Morning"))).toMatch(/^ ▐\s+Morning\s+▌$/u);
    expect(glyphs(rowWith(grid, "Wake up"))).toMatch(/─▐ Wake up ▌─▐ Coffee ▌─/u);
    expect(plain(JOURNEY, "borderless")).toEqual(plain(JOURNEY, "default"));
  });
});

describe("a packet follows the border mode, having no ground to slab", () => {
  it("moves each row's outline onto its cells' edges under padless, the walls between fields meeting the rules", () => {
    const rows = plain(PACKET, "padless");
    expect(rows[1]).toMatch(/^▁+$/u);
    expect(rows[2]).toMatch(/^▏\s+Version\s+│\s+Length\s+▕$/u);
    expect(rows[3]).toMatch(/^▔+$/u);
    expect(rows.join("\n")).not.toMatch(BOX_CORNERS);
  });

  it("keeps its outline under borderless", () => {
    expect(render(PACKET, { width: 80, borders: "borderless" })).toBe(render(PACKET, { width: 80 }));
  });
});
