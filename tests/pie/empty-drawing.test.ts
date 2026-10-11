import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { THREE_PANES } from "../support/drawn.js";

// 40 cells, fewer where the width budget cannot hold the wall, the labels and the percents beside them.
const emptyBar = (width: number, taken: number): string => UNICODE.lineDottedH.repeat(Math.min(40, width - 1 - taken));

const rows = (source: string, width: number): string[] =>
  render(source, { width }).split("\n").map((row) => row.trim()).filter((row) => row !== "");

describe("a pie with nothing to fill its bar, still drawn", () => {
  it.each(THREE_PANES)("draws the title over an empty dotted bar when no slice is given, at %i", (width) => {
    expect(rows("pie title Pets", width)).toEqual(["Pets", emptyBar(width, 0)]);
  });

  it.each(THREE_PANES)("draws the empty bar alone with neither title nor slice, as mermaid its outer circle, at %i", (width) => {
    expect(rows("pie", width)).toEqual([emptyBar(width, 0)]);
  });

  it.each(THREE_PANES)("keeps every legend row at 0.0 % when every value is 0, at %i", (width) => {
    expect(rows('pie title Zero\n "Dogs" : 0\n "Cats" : 0', width)).toEqual([
      "Zero",
      emptyBar(width, "Dogs   0.0%".length),
      "Dogs┃█   0.0%",
      "Cats┃█   0.0%",
    ]);
  });

  it.each(THREE_PANES)("shows [0] under showData when every value is 0, untitled, at %i", (width) => {
    expect(rows('pie showData\n "Dogs" : 0\n "Cats" : 0.0', width)).toEqual([
      emptyBar(width, "Dogs   0.0%  [0]".length),
      "Dogs┃█   0.0%  [0]",
      "Cats┃█   0.0%  [0]",
    ]);
  });
});
