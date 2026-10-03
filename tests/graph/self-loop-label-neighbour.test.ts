import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

// Mirrored across the page, a loop's label was seated on its box's side of the turn and cut by the neighbour.
describe("a self loop's label is written whole beside a neighbour box", () => {
  it.each(["LR", "RL", "TB", "BT"])("direction %s", (direction) => {
    const sources = [
      `flowchart ${direction}\n  A[Start] -- again --> A\n  A --> B[Done]\n`,
      `stateDiagram-v2\n  direction ${direction}\n  A: Start\n  A --> A : again\n  A --> B\n`,
    ];
    for (const source of sources) {
      for (const width of [40, 80]) {
        const drawn = render(source, { width });
        expect(drawn, drawn).toContain("again");
        expect(drawn, drawn).not.toContain("…");
      }
    }
  });

  it("RL draws the LR loop mirrored", () => {
    const lr = render("flowchart LR\n  A[Start] -- again --> A\n  A --> B[Done]\n", { width: 80 }).split("\n")[0];
    const rl = render("flowchart RL\n  A[Start] -- again --> A\n  A --> B[Done]\n", { width: 80 }).split("\n")[0];
    expect(lr).toContain("╮again");
    expect(rl).toContain("again╭");
  });
});
