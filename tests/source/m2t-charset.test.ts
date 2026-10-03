import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const top = (direction: string, key: string): string => `---\n${key}: compat\n---\nflowchart ${direction}\n  A --> B\n`;
const nested = (direction: string, key: string): string => withConfig({ [key]: "compat" }, `flowchart ${direction}\n  A --> B\n`);

// A key of our own, mermaid has no charset: `m2t_charset` swaps the glyphs, the bare `charset` is read no more.
describe("m2t_charset", () => {
  it.each(["TD", "LR"])("draws the compat heads, at the top of the block or under config (%s)", (direction) => {
    for (const framed of [top, nested]) {
      const drawn = render(framed(direction, "m2t_charset"));
      expect(drawn).toMatch(/[▶▼]/u);
      expect(drawn).not.toMatch(/[⏵⏷]/u);
    }
  });

  it.each(["TD", "LR"])("is not read under its bare name (%s)", (direction) => {
    for (const framed of [top, nested]) expect(render(framed(direction, "charset"))).toMatch(/[⏵⏷]/u);
  });
});
