import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const drawn = (css: string, direction: string): string =>
  renderThemed(
    withConfig({ themeCSS: `"${css}"` }, `flowchart ${direction}\n  A[Start] --> B[Finish]\n  B -.-> C[Later]\n  subgraph S [Group]\n    C\n  end\n`),
    { width: 80, background: "light" },
    "default"
  );

const RED = "38;2;255;0;0";
const GREEN = "38;2;0;170;0";
const runs = (text: string): Array<[string, string]> => [...text.matchAll(/\x1b\[([0-9;]*)m([^\x1b]+)/gu)].map(([, sgr, run]) => [sgr, run]);
const inked = (text: string, glyphs: RegExp, ink: string): boolean => runs(text).some(([sgr, run]) => sgr.includes(ink) && glyphs.test(run));

// Measured on mermaid 12.0.0 headless: `.edge-pattern-solid` strokes every edge but not its head, `.arrowMarkerPath`
// paints the heads, `.cluster span` inks a subgraph's title.
describe("a flowchart's own selectors in themeCSS", () => {
  it.each(["TD", "LR"])("`.edge-pattern-solid` strokes every line, the heads kept (%s)", (direction) => {
    const text = drawn(".edge-pattern-solid { stroke: #ff0000; }", direction);
    expect(inked(text, /[│─]/u, RED)).toBe(true);
    expect(inked(text, /[┊┄╎╌┆┈]/u, RED)).toBe(true);
    expect(inked(text, /[⏷⏵▼▶►]/u, RED)).toBe(false);
  });

  it.each(["TD", "LR"])("`.arrowMarkerPath` paints the heads (%s)", (direction) => {
    const text = drawn(".arrowMarkerPath { fill: #00aa00; }", direction);
    expect(inked(text, /[⏷⏵▼▶►]/u, GREEN)).toBe(true);
  });

  it.each(["TD", "LR"])("`.cluster span` inks the subgraph title (%s)", (direction) => {
    const text = drawn(".cluster span { color: #ff0000; }", direction);
    expect(runs(text).find(([, run]) => run.includes("Group"))?.[0]).toContain(RED);
  });
});
