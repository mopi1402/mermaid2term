import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { NEWLINE } from "../../src/text/chars.js";
import { TWO_PANES } from "../support/drawn.js";

const HUGE = 'packet-beta\n0-999999999: "big"\n';
const FIVE = 'packet-beta\n0-9: "a"\n10-99999999: "b"\n100000000-199999999: "c"\n200000000-299999999: "d"\n300000000-399999999: "e"\n';
// Four lines a row (numbers, two rules, the label) for at most 500 rows, plus the slack under them.
const MOST_LINES = 500 * 4 + 20;

describe("a packet with one huge bit range", () => {
  it.each(TWO_PANES)("stops drawing rows at the cap, quickly, at width %i", (width) => {
    const started = Date.now();
    const lines = render(HUGE, { width }).split(NEWLINE);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(lines.length).toBeLessThanOrEqual(MOST_LINES);
    expect(lines.some((line) => line.includes("big"))).toBe(true);
  });

  it("stays bounded themed, with several huge ranges", () => {
    const started = Date.now();
    const drawn = renderThemed(FIVE, { width: 80 }, "default");
    expect(Date.now() - started).toBeLessThan(1000);
    expect(drawn.split(NEWLINE).length).toBeLessThanOrEqual(MOST_LINES);
  });
});
