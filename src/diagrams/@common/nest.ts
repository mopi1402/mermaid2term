// Nesting by indentation, as mermaid's mindmap and treemap read it: each call takes the next item and its indent,
// and gives the item it hangs from, the last one read at a smaller indent (undefined at the top).
export function nestByIndent<T>(): (indent: number, item: T) => T | undefined {
  const open: Array<readonly [number, T]> = [];
  return (indent, item) => {
    while (open.length > 0 && open[open.length - 1][0] >= indent) open.pop();
    const parent = open.at(-1)?.[1];
    open.push([indent, item]);
    return parent;
  };
}
