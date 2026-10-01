export function must<T>(value: T | undefined, what = "a value"): T {
  if (value === undefined) throw new Error(`${what} was expected and none stood`);
  return value;
}

export const oneOf = <T extends string>(options: readonly T[], word: string): T | undefined =>
  options.find((option) => option === word);

// The value a map holds at a key, made and stored there first when none stands.
export function ensured<K, V>(map: Map<K, V>, key: K, make: (key: K) => V): V {
  const known = map.get(key);
  if (known !== undefined) return known;
  const made = make(key);
  map.set(key, made);
  return made;
}

export const pushInto = <K, V>(map: Map<K, V[]>, key: K, item: V): void => {
  ensured(map, key, () => []).push(item);
};

export const addInto = <K, V>(map: Map<K, Set<V>>, key: K, item: V): void => {
  ensured(map, key, () => new Set()).add(item);
};

// A value held within [low, high]; low wins should the bounds cross.
export const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
