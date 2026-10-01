import { NEWLINE, SPACE } from "../text/chars.js";
import { EMPTY } from "./tokens.js";
import { ensured } from "../must.js";

export type StyledRows = ReadonlyArray<ReadonlyArray<readonly [string, string]>>;

export interface PaintedCell {
  readonly ch: string;
  readonly key: string;
  readonly row: ReadonlyArray<readonly [string, string]>;
  readonly at: number;
  readonly from: number;
  readonly to: number;
  readonly url: string | undefined;
}

// A wide character's shadow cell carries none, so a canvas COLUMN is not a string INDEX.
export function* paintedCells(
  styledPairs: StyledRows,
  lines: readonly string[],
  linkRows: ReadonlyArray<ReadonlyArray<string | undefined>>
): Generator<PaintedCell> {
  let pos = 0;
  for (let rowIndex = 0; rowIndex < styledPairs.length; rowIndex++) {
    if (rowIndex >= lines.length) break;
    const line = [...lines[rowIndex]];
    const row = styledPairs[rowIndex];
    const written = row.filter(([ch]) => ch !== EMPTY);
    const rowLinks = linkRows[rowIndex] ?? [];
    const writtenLinks: (string | undefined)[] = [];
    row.forEach(([ch], i) => {
      if (ch !== EMPTY) writtenLinks.push(rowLinks[i] ?? undefined);
    });
    let off = 0;
    for (let at = 0; at < written.length; at++) {
      if (off >= line.length) break;
      const [ch, key] = written[at];
      const size = [...ch].length;
      yield { ch, key, row: written, at, from: pos + off, to: pos + off + size, url: writtenLinks[at] ?? undefined };
      off += size;
    }
    pos += line.length + NEWLINE.length;
  }
}

type CellStyle = (key: string, ch: string, url: string | undefined) => string | undefined;

// A painted cell's style hangs on its key, whether it is blank and its link alone: worked out once for each three.
export function cellStyles(styleOf: CellStyle): CellStyle {
  type Seen = Map<string, string | undefined>;
  const known = new Map<string | undefined, readonly [Seen, Seen]>();
  const fresh = (): readonly [Seen, Seen] => [new Map(), new Map()];
  return (key, ch, url) => {
    const seen = ensured(known, url, fresh)[ch === SPACE ? 1 : 0];
    if (seen.has(key)) return seen.get(key);
    const style = styleOf(key, ch, url);
    seen.set(key, style);
    return style;
  };
}
