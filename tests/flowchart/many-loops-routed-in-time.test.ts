// A run of 250 loops on one box took 15 s: each step a run might drop was weighed by tallying every run again. A move
// changes the tally only on the cells the run leaves or takes, so the weight follows the one run moved.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { tallied } from "../../src/graph/routing/tally.js";
import { type RoutedEdge } from "../../src/graph/routing/routed.js";
import { AttachDir } from "../../src/graph/sides.js";
import { makeEdge } from "../../src/graph/model.js";

const loops = (direction: string): string => `graph ${direction}\nA${"-.".repeat(250)}B\n`;

describe("many loops on one box, routed in time", () => {
  it.each(["TD", "LR"])("draws 250 loops %s in well under the 15 s they took", (direction) => {
    const start = performance.now();
    const drawn = render(loops(direction));
    expect(performance.now() - start).toBeLessThan(4000);
    expect(drawn).toContain("B");
  }, 60_000);

  it("weighs a run moved as a tally made afresh would", () => {
    const run = (source: string, target: string, drawPath: Array<[number, number]>, index: number): RoutedEdge => ({
      edge: makeEdge(source, target),
      gridPath: [],
      drawPath,
      startDir: AttachDir.BOTTOM,
      endDir: AttachDir.TOP,
      label: "",
      index,
      occupiedCells: new Set(),
    });
    const routed = [
      run("A", "B", [[2, 0], [2, 6]], 0),
      run("C", "D", [[0, 3], [6, 3]], 1),
      run("E", "F", [[3, 0], [3, 2], [5, 2], [5, 6]], 2),
    ];
    const solid = new Set(["2,1", "4,3"]);
    const counted = tallied(routed, solid);
    for (const path of [[[0, 4], [6, 4]], [[1, 3], [3, 3], [3, 6]], [[2, 2], [2, 2]]] satisfies Array<Array<[number, number]>>) {
      expect(counted.move(1, path)).toEqual(tallied(routed, solid).total);
    }
  });
});
