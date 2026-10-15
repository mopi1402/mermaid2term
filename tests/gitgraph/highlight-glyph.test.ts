import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const source = (direction: string): string => `gitGraph ${direction}:
    commit id: "schema"
    commit id: "fix-index" type: HIGHLIGHT
    commit id: "migrate"
`;

// mermaid 12 draws a HIGHLIGHT commit as a square framed in the branch's colour around an inner one in its inverse:
// an empty square on screen, never a filled one.
describe("a HIGHLIGHT commit", () => {
  it.each(["LR", "TB"])("is an empty square (%s)", (direction) => {
    const drawn = render(source(direction), { width: 80 });
    expect(drawn).toContain("□");
    expect(drawn).not.toContain("■");
  });
});
