// Every HTML line occupies EXACTLY the columns the canvas drew: one off is a frame that does not close.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { displayWidth, isWideEastAsian, renderThemedText } from "@tayomi/mermaid2term";
import { grid, gridLines, PLAIN_RANGES } from "@/grid";
import { corpus, htmlColumns, TAG } from "./corpus";

const THEME = "default";
const WIDTHS = [40, 80, 128];
const SIDES = [undefined, "light"] as const;

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

describe("the cell grid", () => {
  it("has a corpus to measure", () => {
    expect(corpus.length).toBeGreaterThan(100);
  });

  it("occupies on every line the exact columns the canvas drew, on both sides, for the whole corpus", () => {
    for (const { file, source } of corpus) {
      for (const width of WIDTHS) {
        const painted = renderThemedText(source, { width }, THEME);
        const plain = painted.plain.split("\n");
        for (const side of SIDES) {
          const html = gridLines(painted.toAnsi(side));
          expect(html).toHaveLength(plain.length);
          for (let line = 0; line < plain.length; line++) {
            const expected = displayWidth(plain[line]);
            const actual = htmlColumns(html[line]);
            if (actual !== expected) {
              throw new Error(
                `${path.basename(file)} @${width} ${side ?? "unstated"}, line ${line}: ${actual} HTML columns for ${expected} on the canvas`
              );
            }
          }
        }
      }
    }
  });

  it("makes the NAME a `click` designates clickable, and it alone", () => {
    const source = 'flowchart TB\n  A --> B\n  click B "https://ex.com"';
    const painted = renderThemedText(source, { width: 80 }, THEME);
    const html = gridLines(painted.toAnsi());
    const anchored = html.filter((line) => line.includes("<a href="));
    expect(anchored).toHaveLength(1);
    const line = anchored[0];
    expect(line).toContain('<a href="https://ex.com"');
    expect((line.match(/<a href=/gu) ?? []).length).toBe(1);
    expect((line.match(/<\/a>/gu) ?? []).length).toBe(1);
    const inside = (/<a href="[^"]*"[^>]*>([\s\S]*?)<\/a>/u.exec(line)?.[1] ?? "").replace(TAG, "");
    expect(inside).toBe("B");
  });

  it("paints a block element as a background on its own half of the cell, the glyph hidden", () => {
    const html = gridLines("\u001b[38;2;236;236;255m\u2590\u2584\u001b[0m");
    const line = html[0];
    expect(line).toContain('class="cell block"');
    expect(line).toContain("linear-gradient(rgb(236, 236, 255),rgb(236, 236, 255)) 100% 0/50% 100% no-repeat");
    expect(line).toContain("0 100%/100% 50% no-repeat");
    expect(htmlColumns(line)).toBe(2);
  });

  it("paints the eighths a `padless` border is drawn with on their own eighth of the cell", () => {
    const line = gridLines("\u001b[38;2;1;2;3m\u2581\u2594\u258f\u2595\u001b[0m")[0];
    expect(line).toContain("0 100%/100% 12.5% no-repeat");
    expect(line).toContain("0 0/100% 12.5% no-repeat");
    expect(line).toContain("0 0/12.5% 100% no-repeat");
    expect(line).toContain("100% 0/12.5% 100% no-repeat");
    expect(htmlColumns(line)).toBe(4);
  });

  it("paints a pill's shoulders as two halves of the cell laid over each other", () => {
    const line = gridLines("\u001b[38;2;1;2;3m\u259f\u2582\u001b[0m")[0];
    expect(line).toContain("linear-gradient(rgb(1, 2, 3),rgb(1, 2, 3)) 100% 0/50% 100% no-repeat,linear-gradient(rgb(1, 2, 3),rgb(1, 2, 3)) 0 100%/100% 50% no-repeat");
    expect(line).toContain("0 100%/100% 25% no-repeat");
    expect(htmlColumns(line)).toBe(2);
  });

  it("paints the Powerline point of a flag's notch as one wedge from the cell's right middle, the ink over the ground", () => {
    const line = gridLines("\u001b[38;2;1;2;3m\u001b[48;2;9;9;9m\ue0b0\u001b[0m")[0];
    expect(line).toContain(
      "conic-gradient(from calc(270deg - atan2(0.5lh, 1ch)) at 100% 50%,rgb(1, 2, 3) 0 calc(2 * atan2(0.5lh, 1ch)),transparent 0) 0 0/100% 100% no-repeat,rgb(9, 9, 9)"
    );
    expect(htmlColumns(line)).toBe(1);
  });

  it("paints the Powerline point of a hexagon's left side as the mirror of the right one", () => {
    const line = gridLines("\u001b[38;2;1;2;3m\ue0b2\u001b[0m")[0];
    expect(line).toContain("conic-gradient(from calc(90deg - atan2(0.5lh, 1ch)) at 0 50%,rgb(1, 2, 3) 0 calc(2 * atan2(0.5lh, 1ch)),transparent 0) 0 0/100% 100% no-repeat");
    expect(htmlColumns(line)).toBe(1);
  });

  it("paints an arrowhead as one wedge centred in its cell, its half-angle read off the cell's own units", () => {
    const right = gridLines("\u001b[38;2;1;2;3m\u001b[48;2;9;9;9m\u23f5\u001b[0m")[0];
    expect(right).toContain(
      "conic-gradient(from calc(270deg - atan2(0.25lh, 0.8ch)) at 100% 50%,rgb(1, 2, 3) 0 calc(2 * atan2(0.25lh, 0.8ch)),transparent 0) 50% 50%/80% 50% no-repeat,rgb(9, 9, 9)"
    );
    expect(htmlColumns(right)).toBe(1);
    const left = gridLines("\u001b[38;2;1;2;3m\u23f4\u001b[0m")[0];
    expect(left).toContain("from calc(90deg - atan2(0.25lh, 0.8ch)) at 0 50%,");
    expect(left).toContain(" 50% 50%/80% 50% no-repeat");
    const down = gridLines("\u001b[38;2;1;2;3m\u23f7\u001b[0m")[0];
    expect(down).toContain("from calc(0deg - atan2(0.5ch, 0.4lh)) at 50% 100%,");
    expect(down).toContain(" 50% 50%/100% 40% no-repeat");
    const up = gridLines("\u001b[38;2;1;2;3m\u23f6\u001b[0m")[0];
    expect(up).toContain("from calc(180deg - atan2(0.5ch, 0.4lh)) at 50% 0,");
    expect(up).toContain('class="cell block"');
  });

  it("paints the ring of a circle's mark as one radial gradient centred in its cell, over the ground, an `o` standing in", () => {
    const mark = gridLines("\u001b[38;2;1;2;3m\u001b[48;2;9;9;9m\u2b58\u001b[0m")[0];
    expect(mark).toContain(
      "radial-gradient(circle at 50% 50%,transparent 0.3ch,rgb(1, 2, 3) 0.3ch,rgb(1, 2, 3) 0.42ch,transparent 0.42ch) 0 0/100% 100% no-repeat,rgb(9, 9, 9)"
    );
    expect(mark).toContain('class="cell block"');
    expect(mark).toContain(">o</span>");
    expect(htmlColumns(mark)).toBe(1);
  });

  it("holds the plain drawing's ASCII in a painted cell whose glyph the mono fonts lack, so its row and its selection stay one line tall", () => {
    const heads = gridLines("\u001b[38;2;1;2;3m\u23f5\u23f4\u23f6\u23f7\u001b[0m")[0];
    expect(heads).toContain(">&gt;</span>");
    expect(heads).toContain(">&lt;</span>");
    expect(heads).toContain(">^</span>");
    expect(heads).toContain(">v</span>");
    expect(heads).not.toContain("\u23f5");
    const points = gridLines("\u001b[38;2;1;2;3m\ue0b0\ue0b2\u25e2\u25e5\u001b[0m")[0];
    expect(points).toContain(">&gt;</span>");
    expect(points).toContain(">&lt;</span>");
    expect(points).toContain(">/</span>");
    expect(points).toContain(">\\</span>");
    // A block the mono fonts carry keeps its own glyph, which is what a selection copies.
    expect(gridLines("\u001b[38;2;1;2;3m\u2588\u2581\u001b[0m")[0]).toContain(">\u2588</span>");
  });

  it("paints the four triangles a slope is drawn with as a gradient cut corner to corner", () => {
    const line = gridLines("\u001b[38;2;1;2;3m\u25e2\u25e4\u25e3\u25e5\u001b[0m")[0];
    expect(line).toContain("linear-gradient(to bottom right,transparent 50%,rgb(1, 2, 3) 50%)");
    expect(line).toContain("linear-gradient(to bottom right,rgb(1, 2, 3) 50%,transparent 50%)");
    expect(line).toContain("linear-gradient(to bottom left,transparent 50%,rgb(1, 2, 3) 50%)");
    expect(line).toContain("linear-gradient(to bottom left,rgb(1, 2, 3) 50%,transparent 50%)");
    expect(htmlColumns(line)).toBe(4);
  });

  it("lays a painted block over the ground the token carried", () => {
    const line = gridLines("\u001b[38;2;1;2;3m\u001b[48;2;9;9;9m\u2580\u001b[0m")[0];
    expect(line).toContain("no-repeat,rgb(9, 9, 9)");
    expect(line).not.toContain("background-color");
  });

  it("anchors nothing where the source set no link", () => {
    const painted = renderThemedText("flowchart TB\n  A --> B", { width: 80 }, THEME);
    expect(grid(painted.toAnsi())).not.toContain("<a href=");
  });

  it("counts strokes, the warning sign and circled digits as one column, an emoji as two", () => {
    for (let point = 0x2500; point <= 0x257b; point++) {
      expect(displayWidth(String.fromCodePoint(point))).toBe(1);
    }
    expect(displayWidth("⚠")).toBe(1);
    for (const circled of "①②③") expect(displayWidth(circled)).toBe(1);
    expect(displayWidth("✅")).toBe(2);
    expect(displayWidth("\u{1f680}")).toBe(2);
  });

  it("takes the shortcut only on one-column code points that join nobody", () => {
    for (const [low, high] of PLAIN_RANGES) {
      for (let point = low; point <= high; point++) {
        const character = String.fromCodePoint(point);
        expect(isWideEastAsian(character)).toBe(false);
        expect([...SEGMENTER.segment(`a${character}b`)]).toHaveLength(3);
      }
    }
  });

  it("keeps a composed emoji as ONE grapheme, in ONE box of the width it occupies", () => {
    const cases = [
      { name: "zero width joiner", text: "\u{1f468}‍\u{1f469}‍\u{1f467}", columns: 8 },
      { name: "variation selector", text: "⚠️", columns: 2 },
      { name: "skin tone modifier", text: "\u{1f44d}\u{1f3fd}", columns: 4 },
      { name: "regional indicators", text: "\u{1f1eb}\u{1f1f7}", columns: 2 },
      { name: "combining diacritic", text: "é", columns: 2 },
    ];
    for (const { name, text, columns } of cases) {
      const html = grid(text);
      expect(html.match(/<span class="cell"/g), name).toHaveLength(1);
      expect(htmlColumns(html), name).toBe(columns);
      expect(displayWidth(text), name).toBe(columns);
    }
  });

  it("renders the drawing's text as text, not as tags", () => {
    expect(grid('a<b>&c"d')).toBe('<div class="row"><span class="cell" style="--w:8">a&lt;b&gt;&amp;c"d</span></div>');
  });

  it("makes every row a grid of cells spanning their columns, blocks included, so a wall lands on its column whatever the row holds", () => {
    const lines = gridLines(`ab\u001b[1mcd\u001b[0m\u2588e\nfg`);
    expect(lines[0]).toBe(
      '<span class="cell" style="--w:2">ab</span><span class="cell" style="--w:2;font-weight:bold">cd</span>' +
        '<span class="cell block" style="--w:1;background:linear-gradient(currentColor,currentColor) 0 0/100% 100% no-repeat">\u2588</span>' +
        '<span class="cell" style="--w:1">e</span>'
    );
    expect(lines[1]).toBe('<span class="cell" style="--w:2">fg</span>');
    expect(grid("a\nb")).toBe('<div class="row"><span class="cell" style="--w:1">a</span></div><div class="row"><span class="cell" style="--w:1">b</span></div>');
  });

  it("leaves `color` inheritable on a block cell, an uninked block having nothing but `currentColor` to paint with", () => {
    const sheet = fs.readFileSync(path.resolve(import.meta.dirname, "../src/index.css"), "utf8");
    const rule = /\.block\s*\{([^}]*)\}/u.exec(sheet) ?? undefined;
    expect(rule).toBeDefined();
    expect(rule?.[1]).not.toMatch(/(?:^|;|\s)color\s*:/u);
    expect(rule?.[1]).toContain("text-fill-color");
  });

  it("keeps the colours the library painted, to the value", () => {
    const painted = renderThemedText("graph LR\n    A --> B\n", { width: 40 }, THEME);
    expect(grid(painted.toAnsi())).toContain("color:rgb(");
  });
});
