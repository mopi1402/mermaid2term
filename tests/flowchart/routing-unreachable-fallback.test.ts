import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

// A large flowchart where the pathfinder finds no way for some edge: the run laid in its place stays orthogonal,
// so every later pass reads it, where a straight diagonal threw `segmentCells: unreachable end`.
const wheel = (direction: string): string => {
  let s = `flowchart ${direction}\n`;
  for (let i = 1; i < 112; i++) {
    s += `  n${i % 13} --> n${i}\n`;
    if (i % 3 === 0) s += `  n${i} --> n${Math.floor(i / 2)}\n`;
  }
  return s;
};

describe("an edge the pathfinder cannot route is still drawn along the axes", () => {
  it.each(["TD", "LR"])("%s", (direction) => {
    expect(render(wheel(direction)).length).toBeGreaterThan(0);
  });
});
