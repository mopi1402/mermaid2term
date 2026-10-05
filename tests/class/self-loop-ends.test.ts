import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

// A class self loop's unmarked end met the wall as `└─│`, and its room, reserved in the item, pulled the stem to the
// box below off centre (`╰──╮`).
describe("a class self loop", () => {
  it.each(["TB", "BT", "LR", "RL"])("cuts a tee where its unmarked end meets the wall, direction %s", (direction) => {
    const drawn = render(`classDiagram\n  direction ${direction}\n  A <|-- A : self\n  A <-- B\n`, { width: 80 });
    expect(drawn, drawn).toMatch(/├─┘|└─┤/);
    expect(drawn, drawn).not.toMatch(/│─┘|└─│/);
  });

  it.each(["TB", "BT"])("keeps the stem to its neighbour straight, direction %s", (direction) => {
    const drawn = render(`classDiagram\n  direction ${direction}\n  class Node\n  Node --> Node : next\n  Node --> B\n`, { width: 80 });
    expect(drawn, drawn).not.toMatch(/[╭╮╯╰]/);
  });
});
