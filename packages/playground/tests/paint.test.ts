// What a cell comes out PAINTED as; the grid it sits on is pinned in `grid.test.ts`.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { UNICODE, displayWidth, renderThemedText } from "@tayomi/mermaid2term";
import { grid, gridLines } from "@/grid";
import { isBlock } from "@/paint";
import { FIXTURES, htmlColumns } from "./corpus";

const THEME = "default";

describe("the LIGHT side, where a drawing painted for a dark terminal would fade", () => {
  const INK = /color:rgb\((\d+),\s*(\d+),\s*(\d+)\)/gu;
  const luminance = (r: number, g: number, b: number): number => {
    const channel = (c: number): number => {
      const u = c / 255;
      return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const brightness = (html: string): number => {
    const values = [...html.matchAll(INK)].map((found) =>
      luminance(Number(found[1]), Number(found[2]), Number(found[3]))
    );
    expect(values.length).toBeGreaterThan(0);
    return values.reduce((sum, one) => sum + one, 0) / values.length;
  };

  const SOURCE = fs.readFileSync(path.join(FIXTURES, "sequence", "notes.mmd"), "utf8");

  it("darkens the inks when the page turns light, for every theme", () => {
    for (const theme of ["default", "neon", "mono"]) {
      const painted = renderThemedText(SOURCE, { width: 80 }, theme);
      const dark = brightness(grid(painted.toAnsi("dark")));
      const light = brightness(grid(painted.toAnsi("light")));
      if (!(light < dark)) {
        throw new Error(`${theme}: brightness ${light.toFixed(3)} on the light side against ${dark.toFixed(3)} on the dark`);
      }
    }
  });
});

describe("the composed emoji in a rendered drawing", () => {
  // The library opens an SGR sequence per code point, which splits the cluster: several boxes, columns still right.
  const source = 'graph LR\n    A["\u{1f468}‍\u{1f469}‍\u{1f467}"] --> B["⚠️"] --> C["\u{1f44d}\u{1f3fd}"]\n';

  it("holds the grid despite the cluster split by the style", () => {
    const painted = renderThemedText(source, { width: 128 }, THEME);
    const plain = painted.plain.split("\n");
    const html = gridLines(painted.toAnsi());
    const widths = new Set(plain.filter((line) => line !== "").map(displayWidth));
    expect(widths.size).toBe(1);
    for (let line = 0; line < plain.length; line++) {
      expect(htmlColumns(html[line])).toBe(displayWidth(plain[line]));
    }
  });
});

describe("bold, which the mono font does not carry on strokes", () => {
  const ESC = String.fromCharCode(27);
  const BOLD = `${ESC}[1m`;
  const END = `${ESC}[0m`;

  it("keeps a run of strokes in ONE box and drops its bold, the bold face not knowing how to join it", () => {
    expect(grid("─│┌┐")).toBe('<div class="row"><span class="cell" style="--w:4">─│┌┐</span></div>');
    const stroke = grid(`${BOLD}${ESC}[38;2;212;132;90m─│┌┐${END}`);
    expect(stroke.match(/<span class="cell"/g)).toHaveLength(1);
    expect(stroke).not.toContain("font-weight:bold");
    expect(stroke).toContain("color:rgb(212, 132, 90)");
  });

  it("keeps a run of ASCII in ONE box, bold kept, a mono font carrying it in every face", () => {
    const bold = grid(`${BOLD}Auth${END}`);
    expect(bold.match(/<span class="cell"/g)).toHaveLength(1);
    expect(bold).toContain("--w:4;font-weight:bold");
  });

  it("holds the grid on a drawing where a `linkStyle` made an edge bold", () => {
    const source = [
      "graph LR",
      "  A[Request] --> B[Auth]",
      "  B --> C[Process]",
      "  linkStyle 0 stroke:#22c55e,stroke-width:10px",
      "",
    ].join("\n");
    const painted = renderThemedText(source, { width: 80 }, THEME);
    const plain = painted.plain.split("\n");
    const html = gridLines(painted.toAnsi());
    expect(painted.toAnsi()).toContain("\u001b[1");
    for (let line = 0; line < plain.length; line++) {
      expect(htmlColumns(html[line])).toBe(displayWidth(plain[line]));
    }
  });
});

describe("`dim`, which lowers the foreground only", () => {
  const ESC = String.fromCharCode(27);
  const END = `${ESC}[0m`;
  const BACKGROUND = "background-color:rgb(128, 0, 128)";
  const count = (html: string, piece: string): number => html.split(piece).length - 1;

  it("leaves the background whole under a dimmed character, where opacity took it along", () => {
    const html = grid(`${ESC}[2;36;48;2;128;0;128m│${END}${ESC}[48;2;128;0;128m ${END}`);
    expect(html).not.toContain("opacity");
    expect(count(html, BACKGROUND)).toBe(2);
  });

  it("lowers the ink towards BLACK and not towards the background", () => {
    // anser's cyan is `0,187,187`, so half strength is `0,94,94`, whatever lies behind.
    const html = grid(`${ESC}[2;36m│${END}`);
    expect(html).toContain("color:rgb(0,94,94)");
    expect(html).not.toContain("0.5)");
  });

  it("dims the inherited colour where `dim` comes alone, `mono` painting its strokes so", () => {
    const html = grid(`${ESC}[2m─${END}`);
    expect(html).not.toContain("opacity");
    expect(html).toContain("color-mix(in srgb, currentColor 50%, black)");
  });
});

describe("italic, the second weight, which a style now puts on a node label", () => {
  const ESC = String.fromCharCode(27);
  const ITALIC = `${ESC}[3m`;
  const END = `${ESC}[0m`;

  it("keeps a run of ASCII in ONE box and slants it, a mono font carrying the face", () => {
    const slanted = grid(`${ITALIC}Auth${END}`);
    expect(slanted.match(/<span class="cell"/g)).toHaveLength(1);
    expect(slanted).toContain("--w:4;font-style:italic");
  });

  it("holds the grid on a drawing where a `classDef` slanted a label", () => {
    const source = [
      "flowchart LR",
      "  A[Request] --> B[Auth]",
      "  classDef slanted font-style:italic,fill:#eef",
      "  class B slanted",
      "",
    ].join("\n");
    const painted = renderThemedText(source, { width: 80 }, THEME);
    const plain = painted.plain.split("\n");
    const html = gridLines(painted.toAnsi());
    expect(painted.toAnsi()).toContain(`${ESC}[1;3;`);
    expect(html.join("")).toContain("font-style:italic");
    for (let line = 0; line < plain.length; line++) {
      expect(htmlColumns(html[line])).toBe(displayWidth(plain[line]));
    }
  });
});

describe("the round marks the mono font does not carry", () => {
  // Their fallback face draws them wider than a column, and the next cell's ground painted over the spill cut them.
  const RAW = [UNICODE.circleMarkFilled, UNICODE.smallCircle, UNICODE.framedCircle];

  it("paints each of them as the cell itself, the glyph never reaching the page", () => {
    for (const mark of RAW) {
      const html = grid(mark);
      expect(html).toContain('class="cell block"');
      expect(html).toContain("background:radial-gradient");
      expect(html).not.toContain(mark);
      expect(displayWidth(mark)).toBe(1);
    }
  });

  it("gives the framed one a core inside its band, and the plain ones a band alone", () => {
    const count = (mark: string): number => grid(mark).split("radial-gradient").length - 1;
    expect(count(UNICODE.framedCircle)).toBe(2);
    expect(count(UNICODE.smallCircle)).toBe(1);
    expect(count(UNICODE.circleMarkFilled)).toBe(1);
  });

  it("paints the end state of a drawn state diagram, holding its column", () => {
    const source = "stateDiagram-v2\n    [*] --> Idle\n    Idle --> [*]\n";
    const painted = renderThemedText(source, { width: 60 }, THEME);
    expect(painted.plain).toContain(UNICODE.framedCircle);
    const plain = painted.plain.split("\n");
    const html = gridLines(painted.toAnsi());
    expect(html.join("")).not.toContain(UNICODE.framedCircle);
    expect(html.join("")).toContain('class="cell block"');
    for (let line = 0; line < plain.length; line++) {
      expect(htmlColumns(html[line])).toBe(displayWidth(plain[line]));
    }
  });
});

// A bar's end, inked by one to seven eighths from the bottom or the left.
const BAR_ENDS = [..."▁▂▃▄▅▆▇▏▎▍▌▋▊▉"];

describe("a bar's glyphs, painted as blocks so no seam shows between two cells of one bar", () => {
  it.each([UNICODE.barFull, UNICODE.barBelow, UNICODE.barSplit, ...BAR_ENDS])("paints %s itself rather than leaving it to the font", (glyph) => {
    expect(isBlock(glyph)).toBe(true);
  });
});

describe("a cherry's rounded ends, painted so a font without powerline glyphs still closes the pill", () => {
  it.each([...UNICODE.cherryCaps])("paints %s itself", (glyph) => {
    expect(isBlock(glyph)).toBe(true);
  });
});
