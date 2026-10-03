import { HALF_STRIDE, STRIDE } from "./grid.js";

export function seatLayer(
  nodes: string[],
  targets: number[],
  low: number,
  high: number,
  nearEdge: number,
  onLattice: (coord: number) => number,
  setCoord: (id: string, value: number) => void
): void {
  const seated: number[] = [];
  targets.forEach((want, i) => {
    const floor = i === 0 ? want : (seated[i - 1]) + STRIDE;
    seated.push(Math.max(want, floor));
  });
  const drift = seated.map((at, i) => (targets[i]) - at).sort((a, b) => a - b);
  const shift = onLattice(((drift[0]) + (drift[drift.length - 1])) / 2 + nearEdge) - nearEdge;
  const lo = drift[(drift.length - 1) >> 1];
  const hi = drift[drift.length >> 1];
  const span = (at: number): number =>
    Math.max(high, (seated[seated.length - 1]) + at) - Math.min(low, (seated[0]) + at);
  let chosen = shift;
  let best = span(shift);
  for (let at = lo; at <= hi; at += HALF_STRIDE) {
    const tight = span(at);
    if (tight < best || (tight === best && Math.abs(at - shift) < Math.abs(chosen - shift))) {
      chosen = at;
      best = tight;
    }
  }
  nodes.forEach((id, i) => setCoord(id, (seated[i]) + chosen));
}

