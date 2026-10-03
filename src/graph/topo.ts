import { must } from "../must.js";

export function topoOrder(all: readonly string[], successors: ReadonlyMap<string, Iterable<string>>, inDegree: ReadonlyMap<string, number>): string[] {
  const left = new Map(inDegree);
  const pending = all.filter((id) => left.get(id) === 0);
  const order: string[] = [];
  while (pending.length > 0) {
    const id = must(pending.shift());
    order.push(id);
    for (const succ of successors.get(id) ?? []) {
      const remaining = (left.get(succ) ?? 0) - 1;
      left.set(succ, remaining);
      if (remaining === 0) pending.push(succ);
    }
  }
  return order;
}
