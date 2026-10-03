import { describe, it, expect } from "vitest";
import { cellId, pathCells, segmentCells } from "../../src/canvas/geometry.js";

type P = readonly [number, number];

const handWalk = (a: P, b: P): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  const dx = Math.sign(b[0] - a[0]);
  const dy = Math.sign(b[1] - a[1]);
  let [x, y] = a;
  while (true) {
    out.push([x, y]);
    if (x === b[0] && y === b[1]) break;
    x += dx;
    y += dy;
  }
  return out;
};

describe("a cell has ONE key and a segment ONE walk: `cellId` and `segmentCells` say what three modules and four loops spelt for themselves", () => {
  it("the key is the column, a comma, the row, exactly the template every module typed", () => {
    expect(cellId(3, 7)).toBe(`${3},${7}`);
    expect(cellId(0, -1)).toBe("0,-1");
  });

  it.each<[string, P, P]>([
    ["along the row", [2, 5], [7, 5]],
    ["back along the row", [7, 5], [2, 5]],
    ["down the column", [4, 1], [4, 6]],
    ["up the column", [4, 6], [4, 1]],
    ["a diagonal", [0, 0], [3, 3]],
    ["a single cell", [9, 9], [9, 9]],
  ])("%s: the same cells in the same order as the hand-written walk", (_, a, b) => {
    expect([...segmentCells(a, b)]).toEqual(handWalk(a, b));
  });

  it("a path's cells are every segment's, each corner given once where the old array walk gave it twice", () => {
    const path: P[] = [[0, 0], [3, 0], [3, 2], [1, 2]];
    const cells = [...pathCells(path)];
    expect(cells).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [2, 2], [1, 2]]);
    const seen = new Set(cells.map(([x, y]) => cellId(x, y)));
    expect(seen.size).toBe(cells.length);
    const old = new Set<string>();
    for (let k = 0; k + 1 < path.length; k++) for (const [x, y] of handWalk(path[k], path[k + 1])) old.add(cellId(x, y));
    expect(seen).toEqual(old);
  });

  it("a path of one point or none runs through no cell", () => {
    expect([...pathCells([])]).toEqual([]);
    expect([...pathCells([[4, 4]])]).toEqual([]);
  });
});
