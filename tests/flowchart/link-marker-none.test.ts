import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

// mermaid copies a link's styles into its path's inline `style`, where `marker-end: none` or `marker-start: none`
// outranks the marker the arrow drew: the link is then drawn as if written without that head.
const drawn = (direction: string, body: string): string => render(`flowchart ${direction}\n${body}`, { width: 80 });

describe.each(["TD", "LR"])("a head a link's style sets to none is not drawn, %s", (direction) => {
  it("drops the end head through linkStyle", () => {
    expect(drawn(direction, "  A --> B\n  A --> C\n  linkStyle 0 marker-end:none")).toBe(drawn(direction, "  A --- B\n  A --> C"));
  });

  it("drops the start head of a two-way link", () => {
    expect(drawn(direction, "  A <--> B\n  linkStyle 0 marker-start:none")).toBe(drawn(direction, "  A --> B"));
  });

  it("drops a circle end through a class worn by the link's id, the keyword in any case", () => {
    expect(drawn(direction, "  A e1@--o B\n  A --x C\n  classDef bare marker-end:none\n  class e1 bare\n  linkStyle 1 marker-end: NONE")).toBe(drawn(direction, "  A --- B\n  A --- C"));
  });

  it("drops every head under linkStyle default", () => {
    expect(drawn(direction, "  A --> B\n  B --> C\n  linkStyle default marker-end:none")).toBe(drawn(direction, "  A --- B\n  B --- C"));
  });
});
