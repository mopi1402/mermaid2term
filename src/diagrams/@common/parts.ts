import { pushInto } from "../../must.js";

// The boxes that hang together, in the order `names` lists them: two boxes joined by a pair belong to one part, and a
// box joined to nothing is a part of its own. A pair naming a box outside `names` joins nothing.
export function partsOf(names: readonly string[], pairs: Iterable<readonly [string, string]>): string[][] {
  const owner = new Map<string, string>(names.map((name) => [name, name]));
  const root = (name: string): string => {
    let at = name;
    while (owner.get(at) !== at) at = owner.get(at) ?? at;
    return at;
  };
  for (const [one, two] of pairs) {
    if (!owner.has(one) || !owner.has(two)) continue;
    const source = root(one);
    const target = root(two);
    if (source !== target) owner.set(target, source);
  }
  const parts = new Map<string, string[]>();
  for (const name of names) pushInto(parts, root(name), name);
  return [...parts.values()];
}
