import {
  DEFAULT_STYLE, FILL_TAIL,
  RIM_TAIL, SECTION_PREFIX, WALL_TAIL, isChip,
} from "../canvas/keys.js";
import { SPACE } from "../text/chars.js";
import { chipPadKey } from "./chips.js";
import { seatedOnFill } from "./labels.js";
import { EMPTY } from "./tokens.js";
import { showsNoGround } from "./mix.js";
import { ensured } from "../must.js";

export function trimmedLines(
  rows: ReadonlyArray<ReadonlyArray<readonly [string, string]>>,
  keepSectionTail: boolean,
  paintsFill: (key: string) => boolean = () => true,
  bandShows: (key: string) => boolean = () => false
): string[] {
  const fillTail = FILL_TAIL;
  const lines: string[] = [];
  // A blank's own key alone says whether it shows no ground, or keeps its ground for the fill or the seat it names.
  const blankReads = new Map<string, boolean | undefined>();
  const blankRead = (key: string): boolean | undefined => {
    if (blankReads.has(key)) return blankReads.get(key);
    const painted = (key.endsWith(fillTail) || isChip(key) || key.endsWith(RIM_TAIL) || key.endsWith(WALL_TAIL)) && paintsFill(key);
    const read = showsNoGround(key) ? false : painted || seatedOnFill(key) || bandShows(key) ? true : undefined;
    blankReads.set(key, read);
    return read;
  };
  const padKeeps = new Map<string, boolean>();
  const padKept = (key: string): boolean => ensured(padKeeps, key, paintsFill);
  for (const row of rows) {
    const raw = row.map(([ch]) => ch).join(EMPTY);
    const hasSection = keepSectionTail && row.some(([, key]) => key !== DEFAULT_STYLE && key.startsWith(SECTION_PREFIX));
    // A section's blank is its band and stays; the page past the last band or glyph is tail.
    if (hasSection) {
      let end = 0;
      let at = 0;
      for (const [ch, key] of row) {
        at += ch.length;
        if ((ch !== SPACE && ch !== EMPTY) || (key !== DEFAULT_STYLE && key.startsWith(SECTION_PREFIX))) end = at;
      }
      lines.push(raw.slice(0, end));
      continue;
    }
    // A blank carrying a fill is ink and not tail: trimmed on characters alone, a filled box loses its last column.
    let keep = 0;
    let seen = 0;
    const written = row.filter(([ch]) => ch !== EMPTY);
    written.forEach(([ch, key], at) => {
      seen += ch.length;
      if (ch !== SPACE) {
        if (ch !== EMPTY) keep = seen;
        return;
      }
      const read = blankRead(key);
      if (read === false) return;
      if (read === true) keep = seen;
      else {
        const padKey = chipPadKey(written, at, key);
        if (padKey !== key && padKept(padKey)) keep = seen;
      }
    });
    lines.push(raw.slice(0, keep));
  }
  while (lines.length > 0 && lines[lines.length - 1] === EMPTY) lines.pop();
  return lines;
}
