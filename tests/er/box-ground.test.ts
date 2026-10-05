// An entity box stands on the theme's own ground, as mermaid's `erBox` fills it: `mainBkg` wall to wall, then
// `rowOdd` and `rowEven` over the attribute rows by turns. Measured on the ANSI, cell by cell, since the plain
// drawing says nothing about the ground.

import { describe, expect, it } from "vitest";

import { renderThemed } from "../../src/index.js";
import { stripSgr } from "../support/ansi.js";
import { paintedGrid } from "../support/grid.js";

const WALLS = "│├┤┼";

/** The background of every cell of the drawing, row by row, as the ANSI actually paints it. */
const grounds = (ansi: string): string[][] => paintedGrid(ansi).map((row) => row.map(({ ground }) => ground));

/** The one ground of the row holding `text`, from the wall on its left to the wall on its right, both included. */
const rowGround = (painted: string, text: string): string[] => {
  const plain = stripSgr(painted).split("\n");
  const row = plain.findIndex((line) => line.includes(text));
  expect(row).toBeGreaterThanOrEqual(0);
  const cells = [...plain[row]];
  const at = plain[row].indexOf(text);
  let from = at - 1;
  while (from > 0 && !WALLS.includes(cells[from])) from -= 1;
  let to = at + text.length;
  while (to < cells.length - 1 && !WALLS.includes(cells[to])) to += 1;
  return [...new Set(grounds(painted)[row].slice(from, to + 1))];
};

const source = (direction: string, lead = ""): string => `${lead}erDiagram
    direction ${direction}
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string alpha
        string beta
        string gamma
    }
    ORDER {
        int id
    }
`;

describe.each(["TB", "LR"])("an entity box wears the theme's ER grounds (%s)", (direction) => {
  it("default on a dark ground: #1F2020 around the name, #2C2D2D and #060606 by turns down the rows", () => {
    const painted = renderThemed(source(direction), { width: 80, background: "dark" }, "default");
    expect(rowGround(painted, "CUSTOMER")).toEqual(["#1f2020"]);
    expect(rowGround(painted, "alpha")).toEqual(["#2c2d2d"]);
    expect(rowGround(painted, "beta")).toEqual(["#060606"]);
    expect(rowGround(painted, "gamma")).toEqual(["#2c2d2d"]);
  });

  it("default on a light ground: #ECECFF around the name, #FFFFFF and #F1F1FF by turns", () => {
    const painted = renderThemed(source(direction), { width: 80, background: "light" }, "default");
    expect(rowGround(painted, "CUSTOMER")).toEqual(["#ececff"]);
    expect(rowGround(painted, "alpha")).toEqual(["#ffffff"]);
    expect(rowGround(painted, "beta")).toEqual(["#f1f1ff"]);
  });

  it("a `rowEven` the source states wins over the theme's", () => {
    const lead = `%%{init: {"themeVariables": {"rowEven": "#ff0000"}}}%%\n`;
    const painted = renderThemed(source(direction, lead), { width: 80, background: "dark" }, "default");
    expect(rowGround(painted, "beta")).toEqual(["#ff0000"]);
    expect(rowGround(painted, "alpha")).toEqual(["#2c2d2d"]);
  });
});
