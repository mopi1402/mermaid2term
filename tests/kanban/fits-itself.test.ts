import { describe, it, expect } from "vitest";
import { parseKanban, render, renderKanban } from "../../src/index.js";
import { NEWLINE } from "../../src/text/chars.js";
import { widest } from "../support/drawn.js";

describe("a kanban board is drawn at the gap it was sized at, the width fit leaving its gaps and paddings to it", () => {
  const source = [
    "kanban",
    "  todo[Todo]",
    "    a[Rotate the keys]",
    "    b[Split the worker]",
    "  doing[In Progress]",
    "    c[Bump the client]",
    "  done[Done]",
    "    d[Drop the old index]",
  ].join(NEWLINE);

  for (const width of [40, 62]) {
    it(`keeps the board its own renderer folds within ${width} inside it`, () => {
      expect(widest(renderKanban(parseKanban(source), undefined, undefined, undefined, width).toString())).toBeLessThanOrEqual(width);
    });

    it(`draws the board a width of ${width} asks for as its own renderer does`, () => {
      const own = renderKanban(parseKanban(source), undefined, undefined, undefined, width).toString();
      const trimmed = (drawn: string): string => drawn.split(NEWLINE).map((row) => row.trimEnd()).join(NEWLINE).trimEnd();
      expect(trimmed(render(source, { width }))).toBe(trimmed(own));
    });
  }
});
