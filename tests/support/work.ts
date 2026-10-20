import { Canvas } from "../../src/canvas/canvas.js";

// A source with `depth` frames nested one in the other around `body`.
export const nested = (head: string, open: (i: number) => string, body: string, close: string, depth: number): string =>
  [head, ...Array.from({ length: depth }, (_, i) => open(i)), body, ...Array.from({ length: depth }, () => close)].join("\n");

// How many cell styles and set entries a run reads and lays: a count, where a timing would hang on the machine's load.
export function workOf(run: () => void): { styles: number; entries: number } {
  const getStyle = Canvas.prototype.getStyle;
  const add = Set.prototype.add;
  let styles = 0;
  let entries = 0;
  Canvas.prototype.getStyle = function (row: number, col: number): string {
    styles++;
    return getStyle.call(this, row, col);
  };
  Set.prototype.add = function <T>(this: Set<T>, value: T): Set<T> {
    entries++;
    return add.call(this, value);
  };
  try {
    run();
  } finally {
    Canvas.prototype.getStyle = getStyle;
    Set.prototype.add = add;
  }
  return { styles, entries };
}
