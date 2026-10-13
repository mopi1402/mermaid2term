import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { widest } from "../support/drawn.js";

const BOARD = "kanban\n  a[Alpha column]\n    c1[A fairly long card title here]\n  b[Beta column]\n    c2[Another long card title]\n";
const WORDS = ["Alpha", "column", "A", "fairly", "long", "card", "title", "here", "Beta", "Another"];

const wordsOf = (drawn: string): Set<string> => new Set(drawn.split(/[\s│─┌┐└┘╭╮╰╯]+/u).filter((word) => word !== ""));

describe("kanban under a width budget", () => {
  it.each([40, 60])("folds its titles on words to fit within %i columns", (width) => {
    const out = render(BOARD, { width });
    expect(widest(out)).toBeLessThanOrEqual(width);
    const words = wordsOf(out);
    for (const word of WORDS) expect(words).toContain(word);
  });

  it("keeps a board that already fits as it is drawn unbounded", () => {
    expect(render(BOARD, { width: 120 })).toBe(render(BOARD));
  });
});
