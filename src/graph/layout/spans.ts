export function widenSpan<K>(spans: Map<K, [number, number]>, key: K, at: number): void {
  const span = spans.get(key);
  spans.set(key, span === undefined ? [at, at] : [Math.min(span[0], at), Math.max(span[1], at)]);
}
