import { SPACE } from "../text/chars.js";
import { ACROSS_STROKES, DOWN_STROKES } from "./alphabet.js";
import { BAND_MARK, DEFAULT_STYLE, INK_MARK, unmarked } from "./keys.js";
import { planeList, rotate, type Extent, type Planes } from "./planes.js";

// A cell is blank only when nothing stands on it and no style is laid on it: a space may carry a band's ground.
const blankOf = (planes: Planes) => (r: number, c: number): boolean => planes.grid[r][c] === SPACE && planes.styles[r][c] === DEFAULT_STYLE;

// Up to `most` blank rows moved from the top to the foot, their count returned.
export function raisePlanes(planes: Planes, height: number, most = height): number {
  const blank = blankOf(planes);
  const blankRow = (r: number): boolean => planes.grid[r].every((_, c) => blank(r, c));
  let rows = 0;
  while (rows < Math.min(height, most) && blankRow(rows)) rows++;
  if (rows === 0 || rows >= height) return 0;
  for (const plane of planeList(planes)) rotate(plane, rows);
  return rows;
}

export function alignPlanes(planes: Planes, width: number, height: number): void {
  const blank = blankOf(planes);
  const blankRow = (r: number): boolean => planes.grid[r].every((_, c) => blank(r, c));
  raisePlanes(planes, height);
  let cols = width;
  for (let r = 0; r < height; r++) {
    if (blankRow(r)) continue;
    let first = 0;
    while (first < cols && blank(r, first)) first++;
    cols = Math.min(cols, first);
    if (cols === 0) return;
  }
  if (cols === width) return;
  for (const plane of planeList(planes)) {
    for (const row of plane) rotate(row, cols);
  }
}

// A key with the ink and the ground a style laid on it taken off: a frame inked or filled is still the frame.
const bareKey = (key: string): string => {
  const cuts = [key.indexOf(INK_MARK), key.indexOf(BAND_MARK)].filter((at) => at !== -1);
  return cuts.length === 0 ? key : key.slice(0, Math.min(...cuts));
};

export function compactPlanes(
  planes: Planes,
  extent: Extent,
  keepRows: number,
  keepCols: number,
  spareStyles: ReadonlySet<string>
): Extent {

  // A line takes part only when it holds a stroke and nothing but strokes and air, none of it a box's or a label's.
  const joinsRuns = (strokes: ReadonlySet<string>, length: number, along: number, byRow: boolean): boolean => {
    let sawStroke = false;
    for (let at = 0; at < length; at++) {
      const r = byRow ? along : at;
      const c = byRow ? at : along;
      if (planes.protectedCells[r][c] || planes.textCells[r][c]) return false;
      const ch = planes.grid[r][c];
      // Read against the whole dashed family and not the two glyphs drawn today: a stroke the set does not know
      // disqualifies its row, so adding a dash count would silently take compaction out of every dotted drawing.
      if (ch !== SPACE && (!strokes.has(ch) || spareStyles.has(bareKey(unmarked(planes.styles[r][c]))))) return false;
      if (ch !== SPACE) sawStroke = true;
    }
    return sawStroke;
  };

  // A line repeats the one before it when every cell holds the same glyph under the same style.
  const same = (length: number, along: number, byRow: boolean): boolean => {
    const { grid, styles } = planes;
    if (byRow) {
      const [row, above, ink, inkAbove] = [grid[along], grid[along - 1], styles[along], styles[along - 1]];
      for (let at = 0; at < length; at++) if (row[at] !== above[at] || ink[at] !== inkAbove[at]) return false;
      return true;
    }
    for (let at = 0; at < length; at++) if (grid[at][along] !== grid[at][along - 1] || styles[at][along] !== styles[at][along - 1]) return false;
    return true;
  };

  const doomedIn = (count: number, runsAt: (i: number) => boolean, sameAt: (i: number) => boolean, keep: number): number[] => {
    const doomed: number[] = [];
    let prev = false;
    let run = 0;
    for (let i = 0; i < count; i++) {
      const held = runsAt(i);
      run = held && prev && sameAt(i) ? run + 1 : 1;
      prev = held;
      if (held && run > keep) doomed.push(i);
    }
    return doomed;
  };

  const all = planeList(planes);

  const doomedRows = doomedIn(
    extent.height,
    (r) => joinsRuns(DOWN_STROKES, extent.width, r, true),
    (r) => same(extent.width, r, true),
    keepRows
  );
  for (const plane of all) dropped(plane, doomedRows);
  const height = extent.height - doomedRows.length;

  const doomedCols = doomedIn(
    extent.width,
    (c) => joinsRuns(ACROSS_STROKES, height, c, false),
    (c) => same(height, c, false),
    keepCols
  );
  if (doomedCols.length > 0) for (const plane of all) for (const row of plane) dropped(row, doomedCols);
  const width = extent.width - doomedCols.length;
  return { width, height };
}

// The list with the ascending indices `doomed` taken out, in place and in one pass.
function dropped(list: unknown[], doomed: readonly number[]): void {
  if (doomed.length === 0) return;
  let kept = doomed[0];
  let next = 0;
  for (let at = doomed[0]; at < list.length; at++) {
    if (next < doomed.length && doomed[next] === at) next++;
    else list[kept++] = list[at];
  }
  list.length = kept;
}
