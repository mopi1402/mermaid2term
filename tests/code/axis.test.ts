import { describe, it, expect } from "vitest";
import { Direction, isHorizontal, normalized } from "../../src/graph/model.js";
import { axisOf } from "../../src/graph/axis.js";
import { AttachDir } from "../../src/graph/sides.js";

const DIRECTIONS = [Direction.TB, Direction.TD, Direction.BT, Direction.LR, Direction.RL];
const placed = { grid: { col: 3, row: 7 } };

describe("the flow axis is chosen ONCE: `axisOf` says what fifty inline ternaries said, for every direction", () => {
  for (const direction of DIRECTIONS) {
    const horizontal = isHorizontal(normalized(direction));
    const axis = axisOf(direction);
    it(`${direction}: along and across are the column and the row the way \`horizontal ? col : row\` had them`, () => {
      expect(axis.horizontal).toBe(horizontal);
      expect(axis.along(placed)).toBe(horizontal ? placed.grid.col : placed.grid.row);
      expect(axis.across(placed)).toBe(horizontal ? placed.grid.row : placed.grid.col);
      expect(axis.cell(11, 22)).toEqual(horizontal ? [11, 22] : [22, 11]);
      expect(axis.cell(axis.along(placed), axis.across(placed))).toEqual([placed.grid.col, placed.grid.row]);
    });
    it(`${direction}: the four borders are the ones \`settleMarkPaths\` spelt, and onFlow names ahead and behind alone`, () => {
      expect(axis.ahead).toBe(horizontal ? AttachDir.RIGHT : AttachDir.BOTTOM);
      expect(axis.behind).toBe(horizontal ? AttachDir.LEFT : AttachDir.TOP);
      expect(axis.before).toBe(horizontal ? AttachDir.TOP : AttachDir.LEFT);
      expect(axis.after).toBe(horizontal ? AttachDir.BOTTOM : AttachDir.RIGHT);
      for (const dir of [AttachDir.TOP, AttachDir.BOTTOM, AttachDir.LEFT, AttachDir.RIGHT]) {
        expect(axis.onFlow(dir)).toBe(dir === axis.ahead || dir === axis.behind);
      }
    });
    it(`${direction}: the size maps follow the axis, and a bare \`horizontal\` flag gives the same axis`, () => {
      const sizes = { colWidths: "cols", rowHeights: "rows" };
      expect(axis.sizesAlong(sizes)).toBe(horizontal ? "cols" : "rows");
      expect(axis.sizesAcross(sizes)).toBe(horizontal ? "rows" : "cols");
      expect(axisOf(horizontal)).toBe(axis);
    });
  }
  it("BT and RL are TB and LR: the mirror is the renderer's, never the layout's", () => {
    expect(axisOf(Direction.BT)).toBe(axisOf(Direction.TB));
    expect(axisOf(Direction.RL)).toBe(axisOf(Direction.LR));
    expect(axisOf(Direction.TD)).toBe(axisOf(Direction.TB));
  });
});
