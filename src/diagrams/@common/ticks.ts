// d3-array 3.2.4's `ticks`, as mermaid's linear axes call it through `scaleLinear().ticks()`: about `count` round
// values, one, two or five times a power of ten apart, inside the domain and in its order.
const E10 = Math.sqrt(50);
const E5 = Math.sqrt(10);
const E2 = Math.sqrt(2);
const TEN = 10;

// d3 counts a step under one as its inverse, negated, so every tick is a whole number over it and prints clean.
function tickSpec(start: number, stop: number, count: number): readonly [number, number, number] {
  const step = (stop - start) / Math.max(0, count);
  const power = Math.floor(Math.log10(step));
  const error = step / TEN ** power;
  const factor = error >= E10 ? 10 : error >= E5 ? 5 : error >= E2 ? 2 : 1;
  let i1: number;
  let i2: number;
  let inc: number;
  if (power < 0) {
    inc = TEN ** -power / factor;
    i1 = Math.round(start * inc);
    i2 = Math.round(stop * inc);
    if (i1 / inc < start) ++i1;
    if (i2 / inc > stop) --i2;
    inc = -inc;
  } else {
    inc = TEN ** power * factor;
    i1 = Math.round(start / inc);
    i2 = Math.round(stop / inc);
    if (i1 * inc < start) ++i1;
    if (i2 * inc > stop) --i2;
  }
  if (i2 < i1 && count >= 0.5 && count < 2) return tickSpec(start, stop, count * 2);
  return [i1, i2, inc];
}

export function ticks(start: number, stop: number, count: number): number[] {
  if (!(count > 0)) return [];
  if (start === stop) return [start];
  const reverse = stop < start;
  const [i1, i2, inc] = reverse ? tickSpec(stop, start, count) : tickSpec(start, stop, count);
  if (!(i2 >= i1)) return [];
  const n = i2 - i1 + 1;
  const at = (i: number): number => (reverse ? i2 - i : i1 + i);
  return Array.from({ length: n }, (_, i) => (inc < 0 ? at(i) / -inc : at(i) * inc));
}

// d3-array 3.2.4's `tickStep`: the round step `ticks` spaces about `count` values by.
export function tickStep(start: number, stop: number, count: number): number {
  const reverse = stop < start;
  const [, , inc] = reverse ? tickSpec(stop, start, count) : tickSpec(start, stop, count);
  return (reverse ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
}
