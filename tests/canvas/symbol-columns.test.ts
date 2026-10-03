import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { Canvas } from "../../src/canvas/canvas.js";
import { displayWidth } from "../../src/text/width.js";
import { must } from "../../src/must.js";

const STAR = "★";
const LABEL = `${STAR} done`;
const WALLS = ["│", "├"];

const source = (direction: string): string => `flowchart ${direction}\n  A[${LABEL}] --> B[plain]\n`;

// The display column of the wall glyph closing the label's row, and of the corner closing the frame's top row.
const columnOf = (row: string, from: number, glyphs: readonly string[]): number => {
  const chars = [...row];
  const at = chars.findIndex((ch, i) => i >= from && glyphs.includes(ch));
  return displayWidth(chars.slice(0, must(at >= 0 ? at : undefined)).join(""));
};

describe("a symbol such as a star spends the column the canvas gives it, so the frame around it stays square", () => {
  for (const direction of ["TD", "LR"]) {
    it(`${direction}: the right wall sits in the same column on the label row as on the top row`, () => {
      const rows = render(source(direction)).split("\n");
      const top = rows[0];
      const labelRow = must(rows.find((row) => row.includes(LABEL)));
      const labelEnd = [...labelRow].findIndex((ch) => ch === STAR) + [...LABEL].length;
      expect(columnOf(labelRow, labelEnd, WALLS)).toBe(columnOf(top, 0, ["┐"]));
    });

    it(`${direction}: the label is centred between the walls, no spare column after the star`, () => {
      const rows = render(source(direction)).split("\n");
      const labelRow = must(rows.find((row) => row.includes(LABEL)));
      // boundary: RegExp exec
      const inner = must(/│([^│├]*)[│├]/u.exec(labelRow) ?? undefined)[1];
      const lead = inner.length - inner.trimStart().length;
      const trail = inner.length - inner.trimEnd().length;
      expect(trail).toBe(lead);
    });
  }
});

describe("the canvas advances by the width the layout measured", () => {
  const advance = (text: string): number => {
    const canvas = new Canvas(12, 1);
    canvas.putText(0, 0, `${text}x`);
    for (let col = 0; col < canvas.width; col++) if (canvas.get(0, col) === "x") return col;
    throw new Error("the marker was never written");
  };
  for (const text of [STAR, "✓", "☀", "日", "\u{1f680}", "a"]) {
    it(`agrees with displayWidth on ${text}`, () => {
      expect(advance(text)).toBe(displayWidth(text));
    });
  }
});
