import { LITERAL_NEWLINE, labelRowsOf, widestLabelLine } from "./labels.js";
import { wordWrap } from "./width.js";

export const FOLD_GUARD = 200;

// A label a width budget may fold on words: `room` is the fewest cells it should ever be folded to.
export interface Foldable {
  readonly original: string;
  room: number;
  notch: number;
  read: () => string;
  write: (text: string) => void;
}

export const refolded = (original: string, target: number, separator: string = LITERAL_NEWLINE): string =>
  labelRowsOf(original, separator)
    .flatMap((line) => wordWrap(line, target))
    .join(separator);

// One more notch folded, each notch a row more, never under its room: false when the label could not narrow.
export function foldOnce(held: Foldable, separator: string = LITERAL_NEWLINE): boolean {
  const wide = widestLabelLine(held.read(), separator);
  if (wide <= held.room) return false;
  while (true) {
    held.notch += 1;
    const target = Math.max(held.room, Math.ceil(widestLabelLine(held.original, separator) / held.notch));
    if (target < wide) {
      held.write(refolded(held.original, target, separator));
      return widestLabelLine(held.read(), separator) < wide;
    }
    if (target <= held.room) return false;
  }
}

// The label overhanging its room the most folds a notch at a time until the drawing holds the budget. A fold that does
// not narrow the drawing waits for one that does, labels as wide as each other narrowing it only together, and is
// undone if the drawing is as narrow without it or none ever comes.
export function foldUntil<T extends Foldable>(
  folding: readonly T[],
  budget: number,
  measure: () => number,
  separator: string = LITERAL_NEWLINE,
  roomOf: (held: T) => number = (held) => held.room
): void {
  const spent = new Set<T>();
  const pending = new Map<T, string>();
  let wide = measure();
  for (let guard = 0; guard < FOLD_GUARD; guard++) {
    if (wide <= budget) break;
    let pick: T | undefined;
    let worst = 0;
    for (const held of folding) {
      if (spent.has(held)) continue;
      const room = roomOf(held);
      const overhang = widestLabelLine(held.read(), separator) - room;
      if (overhang > worst) {
        worst = overhang;
        pick = held;
        pick.room = room;
      }
    }
    if (pick === undefined) break;
    const before = pick.read();
    if (!foldOnce(pick, separator)) {
      spent.add(pick);
      continue;
    }
    const now = measure();
    if (now < wide) {
      wide = now;
      for (const [held, unfolded] of pending) {
        const folded = held.read();
        held.write(unfolded);
        if (measure() > wide) held.write(folded);
      }
      pending.clear();
    } else if (!pending.has(pick)) {
      pending.set(pick, before);
    }
  }
  for (const [held, unfolded] of pending) held.write(unfolded);
}
