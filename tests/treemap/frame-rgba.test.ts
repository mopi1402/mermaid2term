// mermaid's dark theme writes `clusterBorder` as `rgba(255,255,255,0.25)`: a treemap frame with no `cScalePeer` seat of
// its own takes that ink, laid on the page as a subgraph's is, and never reaches the terminal as an rgba.

import { describe, expect, it } from "vitest";

import { renderThemedText } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

const TREEMAP = `treemap-beta
    "Engineering"
        "Backend": 45
        "Frontend": 40
        "Infra": 35
    "Product"
        "PM": 20
        "Analytics": 10
    "Design"
        "UX": 15
        "Visual": 10`;

describe.each(TWO_PANES)("a treemap on the dark theme, at width %i", (width) => {
  it.each(["default", "padless", "borderless"] as const)("draws with %s borders", (borders) => {
    const draw = (): string => renderThemedText(TREEMAP, { width, borders, background: "dark" }, "default").toAnsi();
    expect(draw).not.toThrow();
    expect(draw().trim()).not.toBe("");
  });
});
