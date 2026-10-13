import { describe, expect, it } from "vitest";

import { render, renderThemedText } from "../../src/index.js";

const WIDTHS = [80, 120] as const;
const MAP = 'treemap-beta\n"Engineering"\n    "Frontend": 40\n    "Backend": 35\n"Sales"\n    "EMEA": 30\n    "Americas": 45\n';
const LEAF_GLYPHS = /[│─]/u;

const plain = (width: number, borders: "default" | "padless" | "borderless"): string[] => render(MAP, { width, borders }).split("\n");
const themed = (width: number, borders: "default" | "borderless") =>
  renderThemedText(MAP, { width, background: "dark", borders }, "default").rows.flat();

describe("treemap border modes", () => {
  it.each(WIDTHS)("width %i: padless moves a leaf's outline onto the cell edges, the sections keep their dotted frame", (width) => {
    const drawing = plain(width, "padless");
    expect(drawing.join("\n")).not.toMatch(LEAF_GLYPHS);
    expect(drawing.some((row) => /▏\s+Frontend\s+▕/u.test(row))).toBe(true);
    expect(drawing.join("\n")).toContain("┊");
    for (const word of ["Engineering", "Frontend", "Backend", "Sales", "EMEA", "Americas"]) expect(drawing.join("\n")).toContain(word);
  });

  it.each(WIDTHS)("width %i: borderless lays every box as a slab of its ground, no outline left", (width) => {
    const cells = themed(width, "borderless");
    expect(cells.some((cell) => /[│─┊┄┌┐└┘]/u.test(cell.ch))).toBe(false);
    expect(cells.filter((cell) => cell.ch === "▐").length).toBeGreaterThan(0);
    const words = cells.map((cell) => cell.ch).join("");
    for (const word of ["Frontend", "Backend", "EMEA", "Americas"]) expect(words).toContain(word);
  });

  it.each(WIDTHS)("width %i: borderless keeps the outline where no theme lays a ground", (width) => {
    expect(plain(width, "borderless")).toEqual(plain(width, "default"));
  });
});
