const EIGHTHS = 8;

// A run `exact` cells long to the nearest eighth: its whole cells and the eighths of the next one, a remainder
// rounding to all eight counted as one more whole cell.
export const eighthsRun = (exact: number): { readonly whole: number; readonly eighths: number } => {
  const whole = Math.max(0, Math.trunc(exact));
  const eighths = Math.max(0, Math.round((exact - whole) * EIGHTHS));
  return eighths === EIGHTHS ? { whole: whole + 1, eighths: 0 } : { whole, eighths };
};

export const cellId = (col: number, row: number): string => `${col},${row}`;

export function* segmentCells(a: readonly [number, number], b: readonly [number, number]): Generator<[number, number]> {
  const dx = Math.sign(b[0] - a[0]);
  const dy = Math.sign(b[1] - a[1]);
  // Off a 45° diagonal, a walk of one cell on each axis never reaches its end; failing here beats filling the heap.
  if (dx !== 0 && dy !== 0 && Math.abs(b[0] - a[0]) !== Math.abs(b[1] - a[1])) {
    throw new Error(`segmentCells: unreachable end, ${cellId(a[0], a[1])} to ${cellId(b[0], b[1])}`);
  }
  let [x, y] = a;
  for (;;) {
    yield [x, y];
    if (x === b[0] && y === b[1]) return;
    x += dx;
    y += dy;
  }
}

export function* pathCells(path: ReadonlyArray<readonly [number, number]>): Generator<[number, number]> {
  for (let k = 0; k + 1 < path.length; k++) {
    let first = k === 0;
    for (const cell of segmentCells(path[k], path[k + 1])) {
      if (first || cell[0] !== path[k][0] || cell[1] !== path[k][1]) yield cell;
      first = true;
    }
  }
}
