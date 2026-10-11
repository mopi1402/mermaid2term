import { describe, expect, it } from "vitest";

import { parsePieChart, render, renderThemed } from "../../src/index.js";
import { cellShares } from "../../src/diagrams/piechart/shares.js";

const rows = (source: string, width = 80): string[] =>
  render(source, { width }).split("\n").map((row) => row.trimEnd()).filter((row) => row.trim() !== "");

const stackedBar = (source: string): string => rows(source)[0].trim();
// Every slice is the same full block, told apart by its colour: the bar's slices are its distinct inks.
const slicesOf = (source: string): number => {
  const bar = renderThemed(source, { width: 80 }, "default").split("\n").find((row) => row.includes("█")) ?? "";
  return new Set([...bar.matchAll(/\x1b\[([0-9;]*)m█/gu)].map((m) => m[1])).size;
};
const labelsOf = (source: string): readonly string[] => parsePieChart(source).slices.map((s) => s.label);

describe("the stacked bar, cut into whole cells", () => {
  it("is always exactly 40 cells and keeps every slice of 1 % or more", () => {
    const bar = stackedBar('pie\n "A" : 93\n "B" : 5\n "C" : 1\n "D" : 1');
    expect([...bar]).toHaveLength(40);
    expect(slicesOf('pie\n "A" : 93\n "B" : 5\n "C" : 1\n "D" : 1')).toBe(4);
  });

  it("leaves a slice rounding to 0 % out of the bar and keeps it in the legend, as mermaid's circle does", () => {
    const source = 'pie\n "A" : 94\n "B" : 5\n "C" : 0.6\n "D" : 0.4';
    expect([...stackedBar(source)]).toHaveLength(40);
    // 0.6 % shows as `1%` in mermaid and keeps its slice; 0.4 % shows as `0%` and is left out.
    expect(slicesOf(source)).toBe(3);
    expect(rows(source).filter((row) => row.includes("┃"))).toHaveLength(4);
  });

  it("shares by largest remainder, at least one cell each", () => {
    expect(cellShares([94, 5, 0.6, 0.4], 40)).toEqual([37, 1, 1, 1]);
    expect(cellShares([1, 1, 1], 40)).toEqual([14, 13, 13]);
    expect(cellShares([1, 1], 1)).toEqual([1, 1]);
  });
});

describe("the labels under the stacked bar", () => {
  it("never touch: a label filling its segment is followed by a blank before the next", () => {
    const labelRow = rows('pie\n "Bike" : 14\n "Train" : 11\n "Car" : 6\n "Walk" : 4')[1];
    expect(labelRow).toContain("Car 17% 11%");
  });

  it("never start before their own segment", () => {
    const labelRow = rows('pie\n "Tests" : 52\n "Build" : 31\n "Lint" : 17')[1];
    expect(labelRow).not.toContain("Lint");
    expect(labelRow).toContain("Build 31%    17%");
  });

  it("show the percent alone for an empty label", () => {
    expect(rows('pie\n "" : 5\n "b" : 5')[1].trim()).toBe("50%                b 50%");
  });
});

describe("the legend", () => {
  it("pads a wide label by columns, the bar wall untouched", () => {
    const legend = rows('pie\n "日本語" : 5\n "中" : 3').filter((row) => row.includes("┃"));
    expect(legend[0]).toMatch(/^日本語┃/u);
    expect(legend[1]).toMatch(/^ {4}中┃/u);
  });

  it("keeps a zero slice as 0 %, and its value under showData, as mermaid's legend does", () => {
    const legend = rows('pie showData\n "a" : 5\n "z" : 0').filter((row) => row.includes("┃"));
    expect(legend[1]).toMatch(/z┃\S\s+0\.0%\s+\[0\]$/u);
  });

  it("prints a showData value as written, the way mermaid prints the number", () => {
    const legend = rows('pie showData\n "a" : 1234567.891\n "b" : 42.960').filter((row) => row.includes("┃"));
    expect(legend[0]).toContain("[1234567.891]");
    expect(legend[1]).toContain("[42.96]");
  });
});

describe("the grammar of mermaid's pie.langium", () => {
  it("reads a single-quoted, an empty and an escaped label", () => {
    expect(labelsOf(`pie\n 'single' : 5\n "" : 3\n "a \\"b\\" c" : 2\n 'it\\'s' : 1`)).toEqual([
      "single",
      "",
      'a "b" c',
      "it's",
    ]);
  });

  it("keeps `%%` inside a single-quoted label as text", () => {
    expect(labelsOf("pie\n 'a %% b' : 5 %% gone")).toEqual(["a %% b"]);
  });

  it("reads a slice on the header line, after `showData` too", () => {
    expect(labelsOf('pie "a" : 5\n "b" : 3')).toEqual(["a", "b"]);
    const chart = parsePieChart('pie showData "a" : 5');
    expect(chart.showData).toBe(true);
    expect(chart.slices).toHaveLength(1);
  });

  it("reads `showData` only right after `pie`, the rest of a header title being title", () => {
    const chart = parsePieChart('pie title Words showData\n "a" : 5');
    expect(chart.showData).toBe(false);
    expect(chart.title).toBe("Words showData");
  });

  it("collapses runs of blanks in the title and stops it at a comment", () => {
    expect(parsePieChart('pie title  Many   spaces\there %% note\n "a" : 5').title).toBe("Many spaces\there");
    expect(parsePieChart('pie\n title  A   B\n "a" : 5').title).toBe("A B");
  });

  it("keeps the first slice of a name, as mermaid's map does", () => {
    expect(parsePieChart('pie\n "a" : 5\n "a" : 9').slices).toEqual([{ label: "a", value: 5 }]);
  });

  it("refuses the numbers NUMBER_PIE refuses", () => {
    expect(labelsOf('pie\n "dot" : 5.\n "zeros" : 007\n "float" : 007.5\n "neg" : -3\n "zero" : 0')).toEqual([
      "float",
      "zero",
    ]);
  });

  it("is case-sensitive on `title`, as the TITLE terminal is", () => {
    expect(parsePieChart('pie\n Title Pets\n "a" : 5').title).toBe("");
  });

  it("skips an accDescr block whole", () => {
    expect(labelsOf('pie\n accDescr {\n "hidden" : 4\n }\n "k" : 1')).toEqual(["k"]);
  });
});
