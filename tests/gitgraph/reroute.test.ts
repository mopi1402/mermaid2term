import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";

const SOURCE = readFileSync("fixtures/gitgraph/cherry-pick.mmd", "utf8");
// One entry a cell: a cherry two cells wide leaves an empty second one, so columns line up down the drawing.
const grid = (drawn: string): string[][] => drawn.split("\n").map((line) => [...line].flatMap((ch) => (displayWidth(ch) > 1 ? [ch, ""] : [ch])));
// The row a word is written on, a tag's brackets never taken for a commit's own label.
const rowOf = (rows: string[][], word: string): number =>
  rows.findIndex((line) => line.join("").includes(word) && (word.startsWith("[") || !line.join("").includes(`:${word}`)));
const colOf = (rows: string[][], word: string): number => rows[rowOf(rows, word)].join("").indexOf(word) + Math.floor(word.length / 2);

// mermaid 11.17.0 `shouldRerouteArrow`: `refactor` stands between `fix-login` and its cherry-pick on develop, so the
// arrow leaves by a lane halfway across instead of rising at `fix-login` and hiding under main's own line.
describe("an arrow a commit on the way would hide goes round by a lane of its own, as mermaid's does", () => {
  it("rises from the picked commit to a lane between the branches, runs to the pick, and rises into it (LR)", () => {
    const rows = grid(render(SOURCE, { width: 120 }));
    const main = rowOf(rows, "main");
    const develop = rowOf(rows, "develop");
    const login = colOf(rows, "fix-login");
    const pick = rows[main].indexOf("🍒");
    const lane = develop - 2;
    expect(rows[develop][login]).toBe("●");
    expect(rows[lane][login]).toBe("╭");
    expect(rows[develop - 1][login]).toBe("│");
    expect(rows[main + 1][login]).toBe(" ");
    for (let c = login + 1; c < pick; c++) expect(rows[lane][c]).toBe("─");
    expect(rows[lane][pick]).toBe("╯");
    expect(rows[main + 1][pick]).toBe("│");
  });

  it("inks the lane in the branch the arrow leaves, the one standing further across", () => {
    const themed = renderThemed(SOURCE, { width: 120, background: "dark" }, "default").split("\n");
    const inkOf = (row: string, glyph: string): string | undefined => new RegExp(`(38;2;\\d+;\\d+;\\d+)[^m]*m${glyph}`, "u").exec(row)?.[1];
    const develop = themed.findIndex((line) => line.includes("develop"));
    expect(inkOf(themed[develop - 2], "╭")).toBeDefined();
    expect(inkOf(themed[develop - 2], "╭")).toBe(inkOf(themed[develop], "╰"));
  });

  it("keeps a plain rise where nothing stands on the way: fix-timeout still climbs at its own step", () => {
    const rows = grid(render(SOURCE, { width: 120 }));
    const main = rowOf(rows, "main");
    const timeout = colOf(rows, "fix-timeout");
    expect(rows[main][timeout]).toBe("┬");
    for (let r = main + 1; r < rowOf(rows, "develop"); r++) expect(rows[r][timeout]).toBe("│");
  });

  it("goes round by a column halfway across in a vertical graph", () => {
    const rows = grid(render(SOURCE.replace("gitGraph", "gitGraph TB:"), { width: 120 }));
    const login = rowOf(rows, "fix-login") - 1;
    const pick = rowOf(rows, "[🏷️ v2.0.1]");
    const from = rows[login].indexOf("●");
    const to = rows[pick].indexOf("🍒");
    const lane = rows[login].indexOf("╭");
    expect(lane).toBeGreaterThan(to);
    expect(lane).toBeLessThan(from);
    for (let r = login + 1; r < pick; r++) expect(rows[r][lane]).toBe("│");
    expect(rows[pick][lane]).toBe("╯");
  });
});
