// Largest remainder over `width` cells, at least one each, widened only when values outnumber cells.
export function cellShares(values: readonly number[], width: number): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  const cells = Math.max(width, values.length);
  const quotas = values.map((v) => (v / total) * cells);
  const shares = quotas.map((q) => Math.max(1, Math.floor(q)));
  const slack = (i: number): number => quotas[i] - shares[i];
  let drawn = shares.reduce((sum, s) => sum + s, 0);
  while (drawn !== cells) {
    const grow = drawn < cells;
    let pick = -1;
    shares.forEach((share, i) => {
      if (!grow && share <= 1) return;
      if (pick === -1 || (grow ? slack(i) > slack(pick) : slack(i) < slack(pick))) pick = i;
    });
    shares[pick] += grow ? 1 : -1;
    drawn += grow ? 1 : -1;
  }
  return shares;
}
