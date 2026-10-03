import { Direction, isHorizontal, normalized } from "./model.js";
import { AttachDir } from "./sides.js";

export interface Placed {
  readonly grid: { readonly col: number; readonly row: number };
}

export interface Axis {
  readonly horizontal: boolean;
  along(p: Placed): number;
  across(p: Placed): number;
  cell(along: number, across: number): readonly [number, number];
  readonly ahead: AttachDir;
  readonly behind: AttachDir;
  readonly before: AttachDir;
  readonly after: AttachDir;
  onFlow(dir: AttachDir): boolean;
  sizesAlong<T>(sizes: { colWidths: T; rowHeights: T }): T;
  sizesAcross<T>(sizes: { colWidths: T; rowHeights: T }): T;
}

const ACROSS_PAGE: Axis = {
  horizontal: true,
  along: (p) => p.grid.col,
  across: (p) => p.grid.row,
  cell: (along, across) => [along, across],
  ahead: AttachDir.RIGHT,
  behind: AttachDir.LEFT,
  before: AttachDir.TOP,
  after: AttachDir.BOTTOM,
  onFlow: (dir) => dir === AttachDir.LEFT || dir === AttachDir.RIGHT,
  sizesAlong: (sizes) => sizes.colWidths,
  sizesAcross: (sizes) => sizes.rowHeights,
};

const DIAGONAL: Readonly<Record<AttachDir, AttachDir>> = {
  [AttachDir.TOP]: AttachDir.LEFT,
  [AttachDir.LEFT]: AttachDir.TOP,
  [AttachDir.BOTTOM]: AttachDir.RIGHT,
  [AttachDir.RIGHT]: AttachDir.BOTTOM,
};

// Down the page is across the page mirrored on its diagonal.
const transposed = (axis: Axis): Axis => ({
  horizontal: !axis.horizontal,
  along: axis.across,
  across: axis.along,
  cell: (along, across) => {
    const [first, second] = axis.cell(along, across);
    return [second, first];
  },
  ahead: DIAGONAL[axis.ahead],
  behind: DIAGONAL[axis.behind],
  before: DIAGONAL[axis.before],
  after: DIAGONAL[axis.after],
  onFlow: (dir) => axis.onFlow(DIAGONAL[dir]),
  sizesAlong: axis.sizesAcross,
  sizesAcross: axis.sizesAlong,
});

const DOWN_PAGE = transposed(ACROSS_PAGE);

export function axisOf(direction: Direction | boolean): Axis {
  const horizontal = typeof direction === "boolean" ? direction : isHorizontal(normalized(direction));
  return horizontal ? ACROSS_PAGE : DOWN_PAGE;
}
