// The section open at `current`, or a new one from `make` pushed onto `list` when none is yet.
export function openedIn<S>(list: S[], current: S | undefined, make: () => S): S {
  if (current !== undefined) return current;
  const opened = make();
  list.push(opened);
  return opened;
}
