import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";
import { QUADRANT_POINT, QUADRANT_POINT_TEXT } from "../../src/canvas/keys.js";
import { TWO_PANES } from "../support/drawn.js";

// mermaid 12 (checked headless on 2026-09-29): a quoted text loses its quotes, a markdown string its quotes and
// backticks but keeps its asterisks, an axis splits on `--+>` spaced or not, a point's `color` fills its marker
// only, its own style over its class's, and `:::name` names the class, never the label.
const HEAD = "quadrantChart\n";

const markerInks = (source: string, width: number): string[] =>
  renderThemedText(HEAD + source, { width, background: "light" }, "default")
    .rows.flat()
    .filter((cell) => cell.owner?.startsWith(QUADRANT_POINT) === true && cell.owner.startsWith(QUADRANT_POINT_TEXT) === false && cell.ch.trim() !== "")
    .map((cell) => cell.style.toLowerCase());

describe.each(TWO_PANES)("a quadrant chart's quoted text and point styles, at width %i", (width) => {
  it("strips the quotes off axes, quadrant names and point labels", () => {
    const out = render(HEAD + '  x-axis "Quoted left" --> "Quoted right"\n  quadrant-2 "Quoted, with comma"\n  "Quoted point": [0.2, 0.8]', { width });
    expect(out).toContain("Quoted left -> Quoted right");
    expect(out).toMatch(/ Quoted, with comma |Quoted, with +│[^\n]*\n[ │]* comma /u);
    expect(out).toContain(" Quoted point");
    expect(out).not.toContain('"');
  });

  it("keeps a quoted delimiter as text", () => {
    expect(render(HEAD + '  x-axis "a --> b" --> c', { width })).toContain("a --> b -> c");
  });

  it("strips the fence of a markdown string and keeps its asterisks", () => {
    const out = render(HEAD + '  quadrant-1 "`**bold** text`"\n  "`**md** pt`": [0.3, 0.3]', { width });
    expect(out).toContain("**bold** text");
    expect(out).toContain(" **md** pt");
    expect(out).not.toContain("`");
  });

  it.each(["L-->R", "L ---> R", "L---->R"])("splits the axis `%s`", (axis) => {
    expect(render(HEAD + `  x-axis ${axis}\n  y-axis ${axis}`, { width })).toContain("L -> R");
  });

  it("keeps a title's trailing semicolon as mermaid does", () => {
    expect(render(HEAD + "  title Semi ends;", { width })).toContain("Semi ends;");
  });

  it("takes `:::name` out of the label", () => {
    const out = render(HEAD + "  A:::class1: [0.8, 0.1]\n  classDef class1 color: #109060", { width });
    expect(out).toContain(" A");
    expect(out).not.toContain(":::");
    expect(out).not.toContain("class1");
  });

  it("fills the marker in the point's own color, radius and stroke read and ignored", () => {
    expect(markerInks("  B: [0.8, 0.1] color: #ff3300, radius: 10, stroke-width: 5px", width)).toEqual([expect.stringContaining("#ff3300")]);
  });

  it("fills the marker in its class's color, several styles given", () => {
    expect(markerInks("  D:::c2: [0.1, 0.9]\n  classDef c2 color: #908342, radius : 10, stroke-width: 10px", width)).toEqual([
      expect.stringContaining("#908342"),
    ]);
  });

  it("prefers the point's own color to its class's, and its class's to the theme's", () => {
    const own = markerInks("  C:::class1: [0.4, 0.4] color: #0000ff\n  classDef class1 color: #109060", width);
    expect(own).toEqual([expect.stringContaining("#0000ff")]);
    const themed = markerInks("  E:::nothing: [0.4, 0.4]", width);
    expect(themed).toEqual([expect.stringContaining("#333333")]);
  });

  it("leaves the label in the theme's ink", () => {
    const labels = renderThemedText(HEAD + "  B: [0.1, 0.1] color: #ff3300", { width, background: "light" }, "default")
      .rows.flat()
      .filter((cell) => cell.owner?.startsWith(QUADRANT_POINT_TEXT) === true && cell.ch.trim() !== "");
    expect(labels.map((cell) => cell.style.toLowerCase()).some((style) => style.includes("#ff3300"))).toBe(false);
  });
});
