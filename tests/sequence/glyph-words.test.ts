import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const SOURCE = `sequenceDiagram
    participant Jobs@{ "type": "queue" }
    participant Store@{ "type": "database" }
    Jobs->>Store: write
`;

// mermaid 12 writes only a participant's name, under its queue or database glyph, never the type inside it.
describe("a queue and a database glyph", () => {
  it.each(["default", "padless", "borderless"] as const)("hold no word the source did not write (%s)", (borders) => {
    const drawn = render(SOURCE, { width: 80, borders });
    expect(drawn).not.toMatch(/\bqueue\b|\bdb\b/u);
    expect(drawn).toContain("Jobs");
    expect(drawn).toContain("Store");
  });
});
