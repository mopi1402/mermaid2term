import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";
import { withConfig } from "../support/frontmatter.js";

const BODY = "mindmap\n  Root\n    A label of exactly thirty-five cols\n";
const inFrontmatter = (px: number): string => withConfig({ mindmap: { maxNodeWidth: px } }, BODY);
const inInit = (px: number): string => `%%{init: {"mindmap": {"maxNodeWidth": ${px}}}}%%\n${BODY}`;
const widest = (source: string): number => Math.max(...render(source, { width: 120 }).split("\n").map(displayWidth));

describe("`config.mindmap.maxNodeWidth`, read at `wrappingWidth`'s 7.25px per column", () => {
  it("wraps at mermaid's own 200px, 27 columns, without the key", () => {
    const counted = "mindmap\n  Root\n    one two three four five six seven eight\n";
    expect(render(counted, { width: 120 })).toBe(
      render(withConfig({ mindmap: { maxNodeWidth: 200 } }, counted), { width: 120 })
    );
    expect(render(counted, { width: 120 })).toContain("one two three four five six");
    expect(render(counted, { width: 120 })).not.toContain("one two three four five six seven");
  });

  it("wraps at 13 columns for 100px, frontmatter and init alike", () => {
    for (const source of [inFrontmatter(100), inInit(100)]) {
      expect(render(source, { width: 120 }).split("\n")).toEqual(["               A label of", " Root ────────   exactly", "               thirty-five", "                  cols"]);
    }
  });

  it("keeps a label up to 40 columns on one row for 400px", () => {
    for (const source of [inFrontmatter(400), inInit(400)]) {
      expect(render(source, { width: 120 })).toBe(" Root ──────── A label of exactly thirty-five cols");
      expect(widest(source)).toBe(50);
    }
  });
});
