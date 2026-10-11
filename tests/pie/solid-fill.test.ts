import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

const source = `pie title Languages
    "Python" : 40
    "JavaScript" : 30
    "Go" : 20
    "Rust" : 10
`;

const SHADES = /[░▒▓▚▞▄▀▌▐]/u;

// Every slice is full blocks, in the stacked bar and the legend alike: its colour tells it apart, never a texture.
describe("a pie's slices", () => {
  it.each(TWO_PANES)("are drawn in full blocks alone (width %i)", (width) => {
    const drawn = render(source, { width });
    expect(drawn).toContain("█");
    expect(drawn).not.toMatch(SHADES);
  });
});
