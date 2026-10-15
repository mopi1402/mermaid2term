import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const source = (direction: string, merge: string): string => `gitGraph ${direction}:
    commit id: "init"
    branch dev
    commit id: "work"
    checkout main
    ${merge}
`;

// mermaid 12 draws a merge as a ring, its inner circle on the commit's own colour class (`commitSymbolType` MERGE),
// unless the merge writes a `type:` of its own, which then draws as that type.
describe("a merge commit", () => {
  it.each(["LR", "TB"])("is a ring beside the filled plain commits (%s)", (direction) => {
    const drawn = render(source(direction, "merge dev"), { width: 80 });
    expect(drawn).toContain("○");
    expect(drawn.split("●").length - 1).toBe(2);
  });

  it.each(["LR", "TB"])("takes the type it is written with (%s)", (direction) => {
    expect(render(source(direction, "merge dev type: REVERSE"), { width: 80 })).toContain("✖");
    const plain = render(source(direction, "merge dev type: NORMAL"), { width: 80 });
    expect(plain).not.toContain("○");
    expect(plain.split("●").length - 1).toBe(3);
  });
});
