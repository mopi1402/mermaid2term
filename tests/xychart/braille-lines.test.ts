import { describe, expect, it } from "vitest";

import { render, renderThemed } from "../../src/index.js";
import { NEWLINE } from "../../src/text/chars.js";
import { glyphsOf } from "../../src/text/width.js";
import { withConfig } from "../support/frontmatter.js";

const chart = (orientation: string, body: string): string =>
  withConfig({ xyChart: { chartOrientation: orientation } }, `xychart-beta\n    x-axis [a, b, c]\n    y-axis 0 --> 8\n${body}`);

const grid = (source: string): string[][] => render(source, { width: 80 }).split(NEWLINE).map(glyphsOf);

const isDots = (ch: string | undefined): boolean => {
  const code = ch?.codePointAt(0) ?? 0;
  return code > 0x2800 && code <= 0x28ff;
};

describe("an xychart line in braille dots", () => {
  it("runs unbroken from its lowest point to its highest, a dotted cell on every row between (vertical)", () => {
    const rows = grid(chart("vertical", "    line [0, 4, 8]\n"));
    const dotted = rows.flatMap((row, r) => (row.some(isDots) ? [r] : []));
    expect(dotted.length).toBeGreaterThan(10);
    expect(dotted).toEqual(Array.from({ length: dotted.length }, (_, i) => dotted[0] + i));
    const axis = rows.findIndex((row) => row.includes("└"));
    expect(dotted.at(-1)).toBe(axis - 1);
  });

  it("runs unbroken from its lowest point to its highest, a dotted cell on every column between (horizontal)", () => {
    const rows = grid(chart("horizontal", "    line [0, 4, 8]\n"));
    const columns = new Set(rows.flatMap((row) => row.flatMap((ch, c) => (isDots(ch) ? [c] : []))));
    const sorted = [...columns].sort((x, y) => x - y);
    expect(sorted.length).toBeGreaterThan(30);
    expect(sorted).toEqual(Array.from({ length: sorted.length }, (_, i) => sorted[0] + i));
  });

  it.each(["vertical", "horizontal"])("writes a point's label where it covers none of the line's dots (%s)", (orientation) => {
    const bare = grid(chart(orientation, "    line [5, 6, 7]\n"));
    const labelled = grid(chart(orientation, '    line [5 "low", 6, 7 "peak"]\n'));
    bare.forEach((row, r) => row.forEach((ch, c) => (isDots(ch) ? expect(labelled[r]?.[c], `row ${r} col ${c}`).toBe(ch) : undefined)));
  });
});

describe("an xychart vertical bar's top", () => {
  // 15 rows over 0 to 8, padded half a row under 0: 4 reaches 8 of them, 1 reaches 2.375, 8 reaches 15.5.
  it("ends on the eighth its value reaches, whole cells under it", () => {
    const rows = grid(chart("vertical", "    bar [4, 1, 8]\n"));
    const axis = rows.findIndex((row) => row.includes("└"));
    const column = (col: number): string => rows.slice(0, axis).map((row) => row[col] ?? " ").reverse().join("").trimEnd();
    const cols = rows[axis].flatMap((ch, c) => (ch === "┬" ? [c] : []));
    expect(column(cols[0])).toBe("████████");
    expect(column(cols[1])).toBe("██▃");
    expect(column(cols[2])).toBe(`${"█".repeat(15)}▄`);
  });
});

describe("an xychart line laid over a bar", () => {
  const head = withConfig({ theme: "base", themeVariables: { xyChart: { plotColorPalette: '"#4dabf7, #e03131"' } }, xyChart: { chartOrientation: "ORIENTATION" } }, "");
  const source = (orientation: string): string =>
    head.replace("ORIENTATION", orientation) + "xychart-beta\n    x-axis [a, b, c]\n    y-axis 0 --> 8\n    bar [8, 8, 8]\n    line [0, 4, 8]\n";

  it.each(["vertical", "horizontal"])("keeps the bar's colour under the line's dots, in colour (%s)", (orientation) => {
    const out = renderThemed(source(orientation), { width: 80, background: "light" }, "base");
    expect(out).toMatch(/48;2;77;171;247m[\u2801-\u28ff]/u);
  });
});

describe("an xychart bar drawn to the nearest eighth of its value", () => {
  // 15 rows over 0 to 15 and 50 columns over 0 to 50: a value reaches half a cell past its length in cells, the scale's padding.
  const bar = (orientation: string, range: string, body: string): string[][] =>
    grid(withConfig({ xyChart: { chartOrientation: orientation } }, `xychart-beta\n    x-axis [a, b]\n    y-axis ${range}\n${body}`));

  it("counts a remainder rounding to eight eighths as one more whole cell (vertical)", () => {
    const rows = bar("vertical", "0 --> 15", "    bar [2.47, 1]\n");
    const axis = rows.findIndex((row) => row.includes("└"));
    const col = rows[axis].indexOf("┬");
    expect([rows[axis - 1][col], rows[axis - 2][col], rows[axis - 3][col], rows[axis - 4][col] ?? " "]).toEqual(["█", "█", "█", " "]);
  });

  it("counts a remainder rounding to eight eighths as one more whole cell (horizontal)", () => {
    const rows = bar("horizontal", "0 --> 50", "    bar [2.47, 1]\n");
    expect(rows[0].join("")).toMatch(/│███$/u);
  });

  it("keeps a bar's top on its eighth where a line's dots cross it, only the dotted cells taken", () => {
    const rows = bar("vertical", "0 --> 8", "    bar [2.2, 1]\n    line [2.2, 2.2]\n");
    const tip = rows.find((row) => row.some(isDots)) ?? [];
    const start = tip.findIndex((ch) => ch === "│" || ch === "┤") + 1;
    const column = tip.slice(start, start + 4);
    expect(column.some(isDots)).toBe(true);
    for (const ch of column) expect(isDots(ch) ? "▅" : ch).toBe("▅");
  });

  it("runs a bar past the plot's top into the row over it, where its value lies beyond the scale", () => {
    const rows = bar("vertical", '"Score" 0 --> 5', "    bar [10, 2]\n");
    expect(rows[0].join("")).toMatch(/^↑ Score\s+█{4}/u);
  });
});

describe("a later xychart bar's top laid over an earlier bar", () => {
  const head = withConfig({ theme: "base", themeVariables: { xyChart: { plotColorPalette: '"#4dabf7, #e03131"' } }, xyChart: { chartOrientation: "ORIENTATION" } }, "");
  const source = (orientation: string): string =>
    head.replace("ORIENTATION", orientation) + "xychart-beta\n    x-axis [a, b]\n    y-axis 0 --> 8\n    bar [8, 8]\n    bar [2.2, 2.2]\n";

  it.each(["vertical", "horizontal"])("keeps the earlier bar's colour in the rest of the top's cell, in colour (%s)", (orientation) => {
    const out = renderThemed(source(orientation), { width: 80, background: "light" }, "base");
    expect(out).toMatch(/48;2;77;171;247m[▁▂▃▄▅▆▇▏▎▍▌▋▊▉]/u);
  });
});
