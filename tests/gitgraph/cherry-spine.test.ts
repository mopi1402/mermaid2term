import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";

const SOURCE = readFileSync("fixtures/gitgraph/cherry-pick.mmd", "utf8");
const lines = (source: string, charset = "unicode"): string[] => render(source, { width: 120, charset }).split("\n");
const rowOf = (rows: readonly string[], word: string): number => rows.findIndex((line) => line.trimStart().startsWith(word));

describe("a gitGraph reads as mermaid's: a cherry on a pick, dashed bare lines, air under a lane", () => {
  it.each(["LR", "TB", "BT"])("marks a cherry-pick with a cherry, and only a cherry-pick, %s", (direction) => {
    const drawn = lines(SOURCE.replace("gitGraph", `gitGraph ${direction}:`)).join("\n");
    expect(drawn.match(/🍒/gu) ?? []).toHaveLength(2);
    expect(drawn.match(/●/gu) ?? []).toHaveLength(5);
  });

  it("keeps a plain bullet under the compat charset, which draws no emoji", () => {
    const drawn = lines(SOURCE, "compat").join("\n");
    expect(drawn).not.toContain("🍒");
    expect(drawn.match(/●/gu) ?? []).toHaveLength(7);
  });

  it("dashes every branch's bare line from the margin to past the last commit, never into an arrow's corner", () => {
    const rows = lines(SOURCE);
    const main = rows[rowOf(rows, "main")];
    const develop = rows[rowOf(rows, "develop")];
    expect(main).toMatch(/^ +main +╌+●/u);
    expect(main).toMatch(/🍒\ue0b4╌+$/u);
    expect(develop).toMatch(/^ develop +╌+╰─/u);
    expect(develop).toMatch(/●╌+$/u);
    expect(displayWidth(develop)).toBe(displayWidth(main));
  });

  it("dashes a vertical branch's bare line too", () => {
    const rows = lines(SOURCE.replace("gitGraph", "gitGraph TB:"));
    expect(rows[1]).toMatch(/^ +┊ +┊$/u);
    expect(rows[rows.length - 1]).toMatch(/┊$/u);
  });

  it("leaves a blank row between a lane sent round and the branch line under it", () => {
    const rows = lines(SOURCE);
    const develop = rowOf(rows, "develop");
    expect(develop - rowOf(rows, "main")).toBe(4);
    expect(rows[develop - 2]).toContain("╭");
    expect(rows[develop - 2]).not.toContain("v2-base");
    expect(rows[develop - 1]).not.toMatch(/─/u);
    expect(rows[develop - 1]).toMatch(/│ +│ +│/u);
  });

  it("adds no row where no arrow is sent round", () => {
    const rows = lines('gitGraph\n commit id: "a"\n branch dev\n commit id: "b"\n checkout main\n commit id: "c"\n merge dev');
    expect(rowOf(rows, "dev") - rowOf(rows, "main")).toBe(3);
  });


  // Every glyph of a row with the SGR it is written under.
  const inkedCells = (row: string): Array<readonly [string, string]> => {
    const cells: Array<readonly [string, string]> = [];
    let sgr = "";
    for (const found of row.matchAll(/\u001b\[([0-9;]*)m|(\P{M})/gu)) {
      if (found[1] !== undefined) sgr = found[1] === "0" ? "" : found[1];
      else cells.push([found[2], sgr]);
    }
    return cells;
  };

  it.each([
    ["default", "dark", "255;255;255"],
    ["default", "light", "0;0;0"],
    ["base", "light", "0;0;0"],
    ["forest", "dark", "255;255;255"],
    ["base", "dark", "255;255;255"],
    ["neon", "dark", "255;255;255"],
    ["neon", "light", "0;0;0"],
    ["neo", "dark", "204;204;204"],
    ["redux-color", "light", "40;37;61"],
  ] as const)("stands the cherry on a disc that reads against the page, white on a dark one and black on a light one, `nodeBorder` on neo and redux, theme %s on %s", (theme, background, disc) => {
    const row = inkedCells(renderThemed(SOURCE, { width: 120, background }, theme).split("\n").find((line) => line.includes("main")) ?? "");
    const cherries = row.flatMap((cell, at) => (cell[0] === "🍒" ? [at] : []));
    expect(cherries).toHaveLength(2);
    for (const at of cherries) {
      expect(row[at][1]).toContain(`48;2;${disc}`);
      expect(row[at - 1]).toEqual(["\ue0b6", `38;2;${disc}`]);
      expect(row[at + 1]).toEqual(["\ue0b4", `38;2;${disc}`]);
    }
  });

  it("draws no rounded end under the compat charset", () => {
    expect(lines(SOURCE, "compat").join("\n")).not.toMatch(/[\ue0b4\ue0b6]/u);
  });

  it.each(["TB", "BT"])("keeps a vertical tag on its cherry's row, one blank from the rounded end, %s", (direction) => {
    const rows = lines(SOURCE.replace("gitGraph", `gitGraph ${direction}:`));
    expect(rows.some((line) => line.includes("[🏷️ v2.0.1] \ue0b6🍒\ue0b4"))).toBe(true);
    expect(rows.some((line) => line.startsWith("[🏷️ cherry-pick:fix-timeout] \ue0b6🍒\ue0b4"))).toBe(true);
  });

  it.each([["default", "dark"], ["default", "light"], ["neon", "dark"], ["forest", "light"]] as const)(
    "draws the compat bullet in a cherry's red, on no ground of its own, theme %s on %s",
    (theme, background) => {
      const main = renderThemed(SOURCE, { width: 120, background, charset: "compat" }, theme).split("\n").find((line) => line.includes("main")) ?? "";
      const bullets = [...main.matchAll(/\u001b\[([0-9;]*)m[^\u001b]*●/gu)].map((m) => m[1]);
      expect(bullets).toHaveLength(3);
      for (const codes of bullets.slice(1)) {
        expect(codes).toContain("38;2;220;20;60");
        expect(codes).not.toContain("48;2;");
      }
      expect(bullets[0]).not.toContain("38;2;220;20;60");
    }
  );
});

describe("a branch's bare line stands behind the commits, at a quarter of its ink", () => {
  const TWO = 'gitGraph\n commit id: "a"\n branch dev\n commit id: "b"';
  const spineInk = (theme: string, background: "light" | "dark"): string | undefined =>
    /\u001b\[([0-9;]*)m╌/u.exec(renderThemed(TWO, { width: 80, background }, theme).split("\n").find((line) => line.includes("dev")) ?? "")?.[1];

  it.each([
    ["default", "light", "38;2;204;204;204"],
    ["forest", "light", "38;2;191;191;191"],
  ] as const)("mixes a quarter of the line's ink with the page, theme %s on %s", (theme, background, ink) => {
    expect(spineInk(theme, background)).toBe(ink);
  });
});
