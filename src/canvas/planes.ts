export interface Planes {
  readonly grid: string[][];
  readonly styles: string[][];
  readonly protectedCells: boolean[][];
  readonly textCells: boolean[][];
  readonly linkCells: (string | undefined)[][];
  readonly directions: number[][];
}

export const planeList = (planes: Planes): unknown[][][] => [
  planes.grid,
  planes.styles,
  planes.protectedCells,
  planes.textCells,
  planes.linkCells,
  planes.directions,
];

export const rotate = <T>(list: T[], count: number): void => {
  list.push(...list.splice(0, count));
};

export interface Extent {
  readonly width: number;
  readonly height: number;
}

// `fill` and not `Array.from({ length })`: an object with a `length` is not iterable, so the generic path pays a
// prototype lookup and a call per cell, 29ns against 1.4ns, over hundreds of thousands of cells.
const rowOf = <T>(width: number, blank: T): T[] => new Array<T>(width).fill(blank);

export const planeOf = <T>(width: number, height: number, blank: T): T[][] => {
  const plane = new Array<T[]>(height);
  for (let r = 0; r < height; r++) plane[r] = rowOf(width, blank);
  return plane;
};

export function growPlanes(planes: Planes, extent: Extent, newWidth: number, newHeight: number, blankStyle: string, blank: string): Extent {
  if (newWidth <= extent.width && newHeight <= extent.height) return extent;
  const width = Math.max(extent.width, newWidth);
  const height = Math.max(extent.height, newHeight);
  for (let r = 0; r < extent.height; r++) {
    const extra = width - extent.width;
    for (let i = 0; i < extra; i++) {
      planes.grid[r].push(blank);
      planes.styles[r].push(blankStyle);
      planes.protectedCells[r].push(false);
      planes.textCells[r].push(false);
      planes.linkCells[r].push(undefined);
      planes.directions[r].push(0);
    }
  }
  for (let r = extent.height; r < height; r++) {
    planes.grid.push(rowOf(width, blank));
    planes.styles.push(rowOf(width, blankStyle));
    planes.protectedCells.push(rowOf(width, false));
    planes.textCells.push(rowOf(width, false));
    planes.linkCells.push(rowOf<string | undefined>(width, undefined));
    planes.directions.push(rowOf(width, 0));
  }
  return { width, height };
}
