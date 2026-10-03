import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

// A loop's label once lost its letters: mirrored across the page it had no column before the drawing, and down the
// page a box standing just past the loop's gap left it only the half beyond the turn.
describe("a self loop's label is written whole", () => {
  it.each(["LR", "RL"])("across the page, the loop mirrored or not, direction %s", (direction) => {
    for (const source of [`flowchart ${direction}\n  A -- self --> A\n  B -- rel --> A\n`, `stateDiagram-v2\n  direction ${direction}\n  A --> A : self\n  B --> A : rel\n`]) {
      const drawn = render(source, { width: 80 });
      expect(drawn, drawn).toContain("self");
      expect(drawn, drawn).not.toContain("…");
    }
  });

  it.each(["TB", "BT"])("down the page, a box standing just past the loop's gap, direction %s", (direction) => {
    for (const source of [`flowchart ${direction}\n  A -- again --> A\n  B\n`, `stateDiagram-v2\n  direction ${direction}\n  A --> A : again\n  B\n`]) {
      const drawn = render(source, { width: 80 });
      expect(drawn, drawn).toContain("again");
      expect(drawn, drawn).not.toContain("…");
    }
  });
});
