// The cells a fan of `count` edges leaves a box by, centred on its middle and `spread` apart.
export const fanCells = (count: number, spread: number): number[] =>
  Array.from({ length: count }, (_, j) => Math.trunc((j - (count - 1) / 2) * spread));

// Runs that share columns cannot share a row: each takes the first row none of the runs it overlaps already holds,
// two runs overlapping unless `gap` cells or more part them. Given in the order they should be served, the first
// asking gets row 0.
export function stackedRows(spans: ReadonlyArray<readonly [number, number]>, gap = 0): number[] {
  const rows: number[] = [];
  spans.forEach((span, i) => {
    let row = 0;
    while (spans.some((other, j) => j < i && rows[j] === row && Math.max(span[0], other[0]) <= Math.min(span[1], other[1]) + gap)) {
      row += 1;
    }
    rows.push(row);
  });
  return rows;
}
