// Under padless a section's outline rides its parent's ground, but mermaid strokes it in the section's OWN
// `cScalePeer`: the rim keeps that seat, so the outer frame of a treemap is not left in the cluster ink of the page.

import { describe, expect, it } from "vitest";

import { renderThemedText } from "../../src/index.js";
import { contrastRatio } from "../../src/colour/contrast.js";
import { BLACK_RGB, WHITE_RGB, parseHex } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";
import { TWO_PANES } from "../support/drawn.js";

const HEX_RE = /#[0-9a-f]{6}/giu;
const STROKE_RE = /[┌┐└┘┄┊▁▔▏▕]/u;
// Under RULE_RATIO on purpose: the rule floor itself is weighed against the page, this guards the frame vanishing.
const SEEN = 1.5;

const TREEMAP = `treemap-beta
    "Engineering"
        "Backend": 45
        "Frontend": 40
    "Design"
        "UX": 15
        "Visual": 10`;

const weakestStroke = (theme: string, side: "light" | "dark", width: number): number => {
  const page = side === "light" ? WHITE_RGB : BLACK_RGB;
  let weakest = Number.POSITIVE_INFINITY;
  for (const cell of renderThemedText(TREEMAP, { width, borders: "padless", background: side }, theme).rows.flat()) {
    if (!STROKE_RE.test(cell.ch)) continue;
    const [ink, ground] = [...cell.style.matchAll(HEX_RE)].map((hex) => must(parseHex(hex[0])));
    if (ink === undefined) continue;
    weakest = Math.min(weakest, contrastRatio(ink, ground ?? page));
  }
  return weakest;
};

describe.each(TWO_PANES)("a padless treemap's frames stay drawn, at width %i", (width) => {
  it.each([
    ["neo", "dark"],
    ["neo", "light"],
    ["base", "dark"],
    ["base", "light"],
  ] as const)("on %s, %s", (theme, side) => {
    expect(weakestStroke(theme, side, width)).toBeGreaterThanOrEqual(SEEN);
  });
});
