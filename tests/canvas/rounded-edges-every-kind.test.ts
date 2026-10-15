import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";
import { withConfig } from "../support/frontmatter.js";

// A line turning off or onto a run, not a box corner nor a crow's foot chip.
const ROUND_TURN = /─[╮╯]|[╭╰]─/u;
const SHARP_TURN = /─[┐┘]|[┌└]─/u;

const BLOCK = "block-beta\ncolumns 3\nA space B\nspace C space\nA --> C\nB --> C\n";
const er = (direction: string): string => `erDiagram\ndirection ${direction}\nA ||--o{ B : has\nB ||--o{ C : has\nA ||--o{ C : has\nA ||--o{ A : self\n`;
const git = (direction: string): string => `gitGraph ${direction}:\ncommit\nbranch dev\ncommit\ncheckout main\ncommit\nmerge dev\n`;
// A chart line turns only under `compat`: the default charset draws it in braille dots.
const xy = (horizontal: string): string => withConfig({ m2t_charset: "compat" }, `xychart-beta ${horizontal}\nx-axis [a, b, c, d]\nline [1, 5, 2, 8]\n`);
const MINDMAP = "mindmap\nroot\n  A\n  B\n  C\n  D\n  E\n";

const CASES: readonly (readonly [string, string, number])[] = [
  ["block, 60 wide", BLOCK, 60],
  ["block, 120 wide", BLOCK, 120],
  ["er TB", er("TB"), 80],
  ["er LR", er("LR"), 80],
  ["gitgraph LR", git("LR"), 80],
  ["gitgraph TB", git("TB"), 80],
  ["xychart vertical, compat", xy(""), 60],
  ["xychart horizontal, compat", xy("horizontal"), 60],
  ["mindmap, 40 wide", MINDMAP, 40],
  ["mindmap, 80 wide", MINDMAP, 80],
];

const mono = (source: string, width: number, roundedEdges?: boolean): string =>
  render(source, roundedEdges === undefined ? { width } : { width, roundedEdges });
const colour = (source: string, width: number, roundedEdges?: boolean): string =>
  renderThemedText(source, roundedEdges === undefined ? { width } : { width, roundedEdges }, "default").plain;

// Every kind's line turns follow `roundedEdges`: rounded by default, sharp under `--sharp-edges`, colour and mono alike.
describe.each([
  ["mono", mono],
  ["colour", colour],
])("line turns in %s", (_mode, drawn) => {
  it.each(CASES)("%s turn rounded by default", (_name, source, width) => {
    expect(drawn(source, width)).toMatch(ROUND_TURN);
  });
  it.each(CASES)("%s turn sharp under roundedEdges false", (_name, source, width) => {
    const sharp = drawn(source, width, false);
    expect(sharp).not.toMatch(ROUND_TURN);
    expect(sharp).toMatch(SHARP_TURN);
  });
});

// A self message's loop turns off its lifeline and back onto it: the actor boxes around it keep their own corners.
const SELF = "sequenceDiagram\nA->>A: self\nA->>B: hi\nB-->>B: back\n";
const LOOP_ROUND = /[│┃][─┄]+╮[^\n]*\n[^\n]*⏴[─┄]+╯/u;
const LOOP_SHARP = /[│┃][─┄]+┐[^\n]*\n[^\n]*⏴[─┄]+┘/u;

describe.each([
  ["mono", mono],
  ["colour", colour],
])("a sequence self message's loop in %s", (_mode, drawn) => {
  it.each(TWO_PANES)("turns rounded by default at width %i", (width) => {
    expect(drawn(SELF, width)).toMatch(LOOP_ROUND);
  });
  it.each(TWO_PANES)("turns sharp under roundedEdges false at width %i", (width) => {
    const sharp = drawn(SELF, width, false);
    expect(sharp).toMatch(LOOP_SHARP);
    expect(sharp).not.toMatch(LOOP_ROUND);
  });
});
