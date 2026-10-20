import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, Text, paintGraph, parseFlowchart, parsePieChart, parseSequenceDiagram, renderGraph, renderPieChart, renderSequence } from "../../src/index.js";
import { Canvas } from "../../src/canvas/canvas.js";
import { BEL, CSI, ESC, OSC, hyperlinkOpen } from "../../src/paint/escapes.js";
import { TAB } from "../../src/text/chars.js";
import { stripSgr } from "../support/ansi.js";

const TITLE = `${OSC}0;PWNED${BEL}`;
const CLEAR = `${CSI}2J`;
const CONTROLS_RE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/u;
const HYPERLINK_RE = new RegExp(`${ESC}\\]8;;[^${ESC}]*${ESC}\\\\`, "gu");

// The parsers handed out one by one read their source as `render` does, and the last writes refuse a control.
describe("the low-level parsers, renderers and painters never hand the terminal a sequence", () => {
  for (const direction of ["TD", "LR"]) {
    it(`renderGraph(parseFlowchart), ${direction}`, () => {
      const drawn = renderGraph(parseFlowchart(`graph ${direction}\n  A["x${TITLE}y${CLEAR}z"] --> B`));
      expect(drawn).not.toMatch(CONTROLS_RE);
      expect(drawn).toContain("x]0;PWNEDy[2Jz");
    });

    it(`paintGraph keeps a click link closed where it opened, ${direction}`, () => {
      const graph = parseFlowchart(`graph ${direction}\n  A-->B\n  click A "https://x/${ESC}\\\\${TITLE}"`);
      const painted = paintGraph(graph, {}, DEFAULT_THEME).text().toAnsi();
      expect(stripSgr(painted).replace(HYPERLINK_RE, "")).not.toMatch(CONTROLS_RE);
    });
  }

  it("renderPieChart(parsePieChart)", () => {
    expect(renderPieChart(parsePieChart(`pie\n  "x${CLEAR}${TITLE}" : 3\n  "b" : 4`)).toString()).not.toMatch(CONTROLS_RE);
  });

  it("renderSequence(parseSequenceDiagram)", () => {
    expect(renderSequence(parseSequenceDiagram(`sequenceDiagram\n  A->>B: hi${CSI}31mRED`)).toString()).not.toMatch(CONTROLS_RE);
  });

  it("a hyperlink drops the controls of its url", () => {
    expect(hyperlinkOpen(`https://x/${ESC}\\${TITLE}`)).toBe(`${OSC}8;;https://x/\\]0;PWNED${ESC}\\`);
  });

  it("a canvas built by hand refuses a control and draws a tab as a space", () => {
    const canvas = new Canvas(6, 1);
    canvas.put(0, 0, ESC);
    canvas.putText(0, 1, `a${TAB}b${BEL}`);
    expect(canvas.toString()).toBe(" a b");
  });

  it("a Text built by hand drops its controls", () => {
    expect(new Text(`a${TITLE}b`).toAnsi()).toBe("a]0;PWNEDb");
  });
});
