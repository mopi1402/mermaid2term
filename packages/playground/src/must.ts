export function must<T>(value: T | undefined, what = "a value"): T {
  if (value === undefined) throw new Error(`${what} was expected and none stood`);
  return value;
}
