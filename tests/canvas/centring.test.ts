import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { centredAt, centredOffset, displayWidth } from "../../src/text/width.js";

const NARROW = "AAAAAAAA";
const WIDE = "日本語のタイトル";

function margins(drawing: string, title: string): { left: number; right: number } {
  const lines = drawing.split("\n");
  const width = Math.max(...lines.map((line) => displayWidth(line)));
  const row = lines.find((line) => line.includes(title));
  if (row === undefined) throw new Error(`the title ${title} is nowhere in the drawing`);
  const left = displayWidth(row.slice(0, row.indexOf(title)));
  return { left, right: width - left - displayWidth(title) };
}

const PIE = (title: string): string => `pie title ${title}\n  "A" : 50\n  "B" : 50\n`;
const QUADRANT = (title: string): string =>
  `quadrantChart\n  title ${title}\n  x-axis L --> R\n  y-axis D --> U\n  A: [0.3, 0.6]\n`;
const XY = (title: string): string =>
  `xychart-beta\n  title "${title}"\n  x-axis [alpha, bravo, charlie, delta, echo]\n  bar [10, 20, 15, 25, 5]\n`;
const GANTT = (title: string): string =>
  `gantt\n  title ${title}\n  dateFormat YYYY-MM-DD\n  section S\n  A : a1, 2024-01-01, 5d\n`;

describe("a title is centred in columns", () => {
  for (const [kind, source] of [
    ["pie", PIE],
    ["quadrant", QUADRANT],
    ["xychart", XY],
    ["gantt", GANTT],
  ] satisfies Array<[string, (title: string) => string]>) {
    it(`${kind} places a wide title where it places a narrow one`, () => {
      const narrow = margins(render(source(NARROW)), NARROW);
      const wide = margins(render(source(WIDE)), WIDE);
      expect(wide.left - wide.right).toBe(narrow.left - narrow.right);
    });
  }
});

describe("centredAt", () => {
  it("counts columns and not characters", () => {
    expect(centredAt(20, WIDE)).toBe(2);
    expect(centredAt(20, NARROW)).toBe(6);
  });

  it("does not clamp, the caller deciding what a text too wide does", () => {
    expect(centredAt(4, NARROW)).toBe(-2);
  });

  it("keeps an odd spare column on the right", () => {
    expect(centredOffset(8, 3)).toBe(2);
    expect(centredOffset(9, 4)).toBe(2);
  });
});
