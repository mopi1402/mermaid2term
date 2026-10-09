// A journey's score digits 5..1 are a quiet text on the page, drawn in `gridColor`: a pale grid ink is weighed until
// they read there, on both sides.

import { describe, expect, it } from "vitest";

import { renderThemedText } from "../../src/index.js";
import { contrastRatio, QUIET_RATIO } from "../../src/colour/contrast.js";
import { BLACK_RGB, WHITE_RGB, parseHex } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";
import { TWO_PANES } from "../support/drawn.js";

const HEX_RE = /#[0-9a-f]{6}/iu;
const DIGIT_RE = /^[1-5]$/u;

const JOURNEY = `journey
    title My Working Day
    section Morning
      Wake up: 3: Me
      Go to work: 1: Me
    section Work
      Lunch: 5: Me`;

// The lowest ratio any score digit reads at on the page. A digit inside a task box is a task's, not the scale's.
const lowestDigit = (theme: string, side: "light" | "dark", width: number): number => {
  const page = side === "light" ? WHITE_RGB : BLACK_RGB;
  const rows = renderThemedText(JOURNEY, { width, background: side }, theme).rows;
  let lowest = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const last = [...row].reverse().find((cell) => DIGIT_RE.test(cell.ch));
    if (last === undefined) continue;
    lowest = Math.min(lowest, contrastRatio(must(parseHex(HEX_RE.exec(last.style)?.[0] ?? ""), last.style), page));
  }
  return lowest;
};

describe.each(TWO_PANES)("a journey's score digits read on the page, at width %i", (width) => {
  it.each([
    ["default", "light"],
    ["default", "dark"],
    ["neutral", "light"],
    ["neutral", "dark"],
  ] as const)("on %s, %s", (theme, side) => {
    expect(lowestDigit(theme, side, width)).toBeGreaterThanOrEqual(QUIET_RATIO);
  });
});
