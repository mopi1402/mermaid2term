import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const ORIENTATIONS = ["vertical", "horizontal"];

const chart = (orientation: string, body: string, config = ""): string =>
  withConfig(`  xyChart:\n    chartOrientation: ${orientation}\n${config}`, `xychart-beta\n${body}`);

const rows = (source: string): string[] => render(source, { width: 120 }).split("\n").map((row) => row.trimEnd());

const TITLED = '    x-axis [a, b, c]\n    bar "Revenue" [5, 6, 7]\n    line Target [4, 6, 8]\n';

// Measured on mermaid 12.0.0 headless (2026-09-29).
describe("xychart plot titles and the legend", () => {
  it.each(ORIENTATIONS)("keeps a titled plot and lists it right of the plot, a square for a bar, a stroke for a line (%s)", (orientation) => {
    const out = rows(chart(orientation, TITLED));
    expect(out.some((row) => row.includes("█"))).toBe(true);
    const bar = out.findIndex((row) => row.endsWith("█ Revenue"));
    const line = out.findIndex((row) => row.endsWith("─ Target"));
    expect(bar).toBeGreaterThan(-1);
    expect(line).toBe(bar + 1);
  });

  it.each(ORIENTATIONS)("glues an unquoted several-word title as mermaid's lexer does (%s)", (orientation) => {
    const out = rows(chart(orientation, "    line Big Target [4, 6, 8]\n"));
    expect(out.some((row) => row.endsWith("─ BigTarget"))).toBe(true);
  });

  it.each(ORIENTATIONS)("draws no legend under showLegend: false, the plot kept (%s)", (orientation) => {
    const out = rows(chart(orientation, TITLED, "    showLegend: false\n"));
    expect(out.some((row) => row.includes("█"))).toBe(true);
    expect(out.join("\n")).not.toMatch(/Revenue|Target/u);
  });
});

describe("xychart lines in either orientation", () => {
  it.each(ORIENTATIONS)("lays a chart holding a line out as its orientation says (%s)", (orientation) => {
    const out = rows(chart(orientation, "    x-axis [alpha, beta, gamma]\n    bar [5, 6, 7]\n    line [4, 6, 8]\n"));
    const sideways = out.some((row) => /^\s*alpha [│├┤]/u.test(row));
    expect(sideways).toBe(orientation === "horizontal");
  });

  it.each(ORIENTATIONS)("writes a point's label by it in the line's place, the values kept on their categories (%s)", (orientation) => {
    const labelled = rows(chart(orientation, '    x-axis [a, b, c]\n    y-axis 0 --> 8\n    line [5 "low", 6, 7 "peak"]\n'));
    const bare = rows(chart(orientation, "    x-axis [a, b, c]\n    y-axis 0 --> 8\n    line [5, 6, 7]\n"));
    const peak = labelled.findIndex((row) => row.includes("peak"));
    expect(peak).toBeGreaterThan(-1);
    expect(labelled.some((row) => row.includes("low"))).toBe(true);
    const strip = (row: string): string => row.replace(/low|peak/gu, (word) => " ".repeat(word.length)).trimEnd();
    const drawn = (all: string[]): string[] => all.filter((row) => row !== "");
    expect(drawn(labelled.map(strip))).toEqual(drawn(bare));
    const column = labelled[peak].indexOf("peak");
    if (orientation === "vertical") expect(labelled[peak + 1].slice(column, column + 4)).toMatch(/[\u2801-\u28ff]/u);
    else expect(labelled[peak].slice(column - 2, column).trim()).not.toBe("");
  });
});

describe("xychart x-axis statements", () => {
  it.each(ORIENTATIONS)("reads an unquoted title before the categories (%s)", (orientation) => {
    const out = rows(chart(orientation, "    x-axis Month [jan, feb]\n    bar [1, 2]\n")).join("\n");
    expect(out).toMatch(/jan/u);
    expect(out).toMatch(/feb/u);
    expect(out).toMatch(/Month/u);
    expect(out).not.toMatch(/\[/u);
  });

  it.each(ORIENTATIONS)("keeps a comma inside a quoted category (%s)", (orientation) => {
    const out = rows(chart(orientation, '    x-axis ["c,d", e]\n    bar [1, 2]\n')).join("\n");
    expect(out).toMatch(/c,d/u);
    expect(out).not.toMatch(/"/u);
  });
});

describe("xychart showDataLabel", () => {
  it.each(ORIENTATIONS)("writes each bar's value inside it (%s)", (orientation) => {
    const out = rows(chart(orientation, "    x-axis [a, b, c]\n    bar [5, 60, 7]\n", "    showDataLabel: true\n"));
    // The bar of the highest value ends half a cell short of the padded plot, past the cell the value ends on.
    const inside = orientation === "vertical" ? /█60|60█/u : /█60[▏▎▍▌▋▊▉█]/u;
    expect(out.some((row) => inside.test(row))).toBe(true);
  });

  it.each(ORIENTATIONS)("writes nothing when the key is left out (%s)", (orientation) => {
    const out = rows(chart(orientation, "    x-axis [a, b, c]\n    bar [5, 60, 7]\n"));
    expect(out.some((row) => /█60|60█/u.test(row))).toBe(false);
  });
});

describe("xychart lines crossing", () => {
  const FIRST = "    line [1, 5, 2, 8]\n";
  const SECOND = "    line [8, 2, 5, 1]\n";
  const COMPAT = "  m2t_charset: compat\n";
  const drawn = (orientation: string, lines: string, config = ""): string[] =>
    render(chart(orientation, `    x-axis [a, b, c, d]\n    y-axis 0 --> 8\n${lines}`, config), { width: 60 }).split("\n");
  const dotsOf = (ch: string | undefined): number => {
    const code = ch?.codePointAt(0) ?? 0;
    return code >= 0x2800 && code <= 0x28ff ? code - 0x2800 : 0;
  };

  it.each(ORIENTATIONS)("keeps every dot the first line lays, the later one's dots set beside them, never a crossing (%s)", (orientation) => {
    const alone = drawn(orientation, FIRST);
    const both = drawn(orientation, FIRST + SECOND);
    alone.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const mine = dotsOf(ch);
        if (mine !== 0) expect(dotsOf([...(both[r] ?? "")][c]) & mine, `row ${r} col ${c}`).toBe(mine);
      });
    });
    expect(both.join("\n")).not.toContain("┼");
    expect(both).not.toEqual(alone);
  });

  it.each(ORIENTATIONS)("under compat, keeps every cell the first line holds, the later one cut or parted from it, never merged (%s)", (orientation) => {
    const alone = drawn(orientation, FIRST, COMPAT);
    const both = drawn(orientation, FIRST + SECOND, COMPAT);
    alone.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch !== " ") expect([...(both[r] ?? "")][c], `row ${r} col ${c}`).toBe(ch);
      });
    });
    expect(both.join("\n")).not.toContain("┼");
    expect(both).not.toEqual(alone);
  });
});
