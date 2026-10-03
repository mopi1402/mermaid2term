import { type Cell } from "../support/grid.js";
import { ARROW, DEFAULT_STYLE, FILL_TAIL, SUBGRAPH_LABEL, isChip } from "../../src/canvas/keys.js";
import { ACROSS_STROKES, CROSSINGS, DASHED_HORIZONTAL, DASHED_VERTICAL, DOWN_STROKES, armsOf } from "../../src/canvas/alphabet.js";
import { LIGHT, NONE } from "../../src/canvas/arms.js";

export interface Breach {
  readonly row: number;
  readonly col: number;
  readonly ch: string;
  readonly ground: string;
  readonly wanted: string;
  readonly owner: string;
}

// A wall drawn on ONE edge of its cell leaves the rest of that cell to the side away from its ink, where it shows
// the ground of what lies there. Which side, by the edge the glyph inks.
const AWAY: ReadonlyMap<string, readonly [number, number]> = new Map([
  ["▏", [0, 1]], ["▌", [0, 1]],
  ["▕", [0, -1]], ["▐", [0, -1]],
  ["▁", [-1, 0]], ["▄", [-1, 0]],
  ["▔", [1, 0]], ["▀", [1, 0]],
]);

// The key a cell is owned by, its band and ink tails off: what it is, not what is laid over it.
const BAND = "@bg:";
const INK = "@ink:";
const ownerOf = (key: string): string => {
  const band = key.indexOf(BAND);
  const bare = band === -1 ? key : key.slice(0, band);
  const ink = bare.indexOf(INK);
  return ink === -1 ? bare : bare.slice(0, ink);
};

// A blank holding an object's fill: the theme's, or a `fill:` written on a frame, laid as a band over the bare ground.
const laysFill = (key: string): boolean => ownerOf(key).endsWith(FILL_TAIL) || (ownerOf(key) === DEFAULT_STYLE && key.includes(BAND));

// A blank holding an object's fill gives that ground to every edge wall whose free part opens on it: the wall's cell
// is half inside the object, and no other ground shows between the line and the fill it closes.
export function edgeWallBreaches(grid: readonly Cell[][]): Breach[] {
  const breaches: Breach[] = [];
  grid.forEach((cells, row) => {
    cells.forEach(({ ch, ground, owner }, col) => {
      const away = AWAY.get(ch);
      if (away === undefined) return;
      const next = grid[row + away[0]]?.[col + away[1]];
      if (next === undefined || next.ch !== " " || !laysFill(next.owner)) return;
      if (next.ground !== ground) breaches.push({ row, col, ch, ground, wanted: next.ground, owner: `${owner} -> ${next.owner}` });
    });
  });
  return breaches;
}

const SIDES: ReadonlyArray<readonly [number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];

// Cells showing the page that the page outside never reaches, walled in by one ground alone, are a hole in the object
// that ground belongs to. Reaching the outside is what tells the page between two boxes from a hole in one: that
// page always runs out between them, through the lines, which stand on the page too.
export function holeBreaches(grid: readonly Cell[][]): Breach[] {
  const breaches: Breach[] = [];
  const seen = grid.map((cells) => cells.map(() => false));
  grid.forEach((cells, row) => {
    cells.forEach((start, col) => {
      if (start.ground !== "" || seen[row][col]) return;
      seen[row][col] = true;
      const region: Array<readonly [number, number]> = [];
      const walls = new Set<string>();
      let open = false;
      const queue: Array<readonly [number, number]> = [[row, col]];
      while (queue.length > 0) {
        const [r, c] = queue.pop() ?? [row, col];
        region.push([r, c]);
        for (const [dr, dc] of SIDES) {
          const next = grid[r + dr]?.[c + dc];
          if (next === undefined) open = true;
          else if (next.ground !== "") walls.add(next.ground);
          else if (!seen[r + dr][c + dc]) {
            seen[r + dr][c + dc] = true;
            queue.push([r + dr, c + dc]);
          }
        }
      }
      if (open || walls.size !== 1) return;
      const [wanted] = walls;
      const [r, c] = region.reduce((a, b) => (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? a : b));
      const { ch, owner } = grid[r][c];
      breaches.push({ row: r, col: c, ch, ground: "", wanted, owner: `${owner}, ${region.length} cell(s)` });
    });
  });
  return breaches;
}

const LETTER_RE = /^[\p{L}\p{N}]$/u;
const isLetter = (cell: Cell | undefined): boolean => cell !== undefined && LETTER_RE.test(cell.ch);

// A word stands on its container's ground: the one the blanks on both sides of it show, when they agree. A chip is a
// container of its own, padded or not; a word straddling two grounds, a message across a box's edge, is left to the
// blanks, since mermaid lays such a word over both.
export function wordGroundBreaches(grid: readonly Cell[][]): Breach[] {
  const breaches: Breach[] = [];
  grid.forEach((cells, row) => {
    for (let col = 0; col < cells.length; col++) {
      if (!isLetter(cells[col]) || isLetter(cells[col - 1])) continue;
      let end = col;
      while (isLetter(cells[end + 1])) end += 1;
      const before = cells[col - 1];
      const after = cells[end + 1];
      // Only a blank shows its container's ground: a wall beside a word is a line on the page, whatever it closes.
      const sides = before?.ch === " " && after?.ch === " " && before.ground === after.ground ? before.ground : undefined;
      const word = cells.slice(col, end + 1);
      const off = word.find((cell) => cell.ground !== sides);
      if (sides !== undefined && off !== undefined && !isChip(off.owner) && word.every((cell) => cell.ground === off.ground)) {
        breaches.push({ row, col, ch: word.map((cell) => cell.ch).join(""), ground: off.ground, wanted: sides, owner: `${off.owner} between ${before?.owner} and ${after?.owner}` });
      }
      col = end;
    }
  });
  return breaches;
}

const LEFT = 0;
const RIGHT = 1;
const UP = 2;
const DOWN = 3;
const DASHED: ReadonlySet<string> = new Set([...DASHED_HORIZONTAL, ...DASHED_VERTICAL]);
const STRAIGHT: ReadonlySet<string> = new Set([...ACROSS_STROKES, ...DOWN_STROKES]);

const armed = (cell: Cell | undefined, ...arms: number[]): boolean => {
  const found = cell === undefined ? undefined : armsOf(cell.ch);
  return found !== undefined && arms.every((arm) => found[arm] !== NONE);
};
const bare = (cell: Cell | undefined, ...arms: number[]): boolean => {
  const found = cell === undefined ? undefined : armsOf(cell.ch);
  return found !== undefined && arms.every((arm) => found[arm] === NONE);
};

// The cells of a closed box drawn in lines from its top-left corner, its four sides walked corner to corner, or
// undefined when the lines do not close.
function boxFrom(grid: readonly Cell[][], top: number, left: number): Cell[] | undefined {
  let right = left + 1;
  while (armed(grid[top][right], LEFT, RIGHT)) right += 1;
  if (!armed(grid[top][right], LEFT, DOWN) || !bare(grid[top][right], RIGHT)) return undefined;
  let bottom = top + 1;
  while (armed(grid[bottom]?.[left], UP, DOWN)) bottom += 1;
  if (!armed(grid[bottom]?.[left], UP, RIGHT) || !bare(grid[bottom]?.[left], DOWN)) return undefined;
  const sides: Cell[] = [];
  for (let c = left; c <= right; c++) sides.push(grid[top][c], grid[bottom][c]);
  for (let r = top + 1; r < bottom; r++) sides.push(grid[r][left], grid[r][right]);
  const closes = sides.every((cell) => armsOf(cell.ch) !== undefined) && armed(grid[bottom][right], LEFT, UP);
  const walled = grid.slice(top + 1, bottom).every((cells) => armed(cells[right], UP, DOWN));
  return closes && walled ? sides : undefined;
}

// An outline is dashed all round or not at all: a box whose sides mix dashed runs and solid ones has lost its dash
// somewhere on the way. Corners and tees carry no dash in any box, so only the straight runs are read.
export function dashBreaches(grid: readonly Cell[][]): Breach[] {
  const breaches: Breach[] = [];
  grid.forEach((cells, row) => {
    cells.forEach((cell, col) => {
      if (!armed(cell, RIGHT, DOWN) || !bare(cell, LEFT, UP)) return;
      const sides = boxFrom(grid, row, col);
      if (sides === undefined) return;
      const runs = sides.filter((side) => STRAIGHT.has(side.ch));
      const dashed = runs.find((side) => DASHED.has(side.ch));
      const solid = runs.find((side) => !DASHED.has(side.ch));
      if (dashed !== undefined && solid !== undefined) breaches.push({ row, col, ch: `${dashed.ch} and ${solid.ch}`, ground: "", wanted: "", owner: `${dashed.owner} / ${solid.owner}` });
    });
  });
  return breaches;
}

// A glyph meant as one: an end's mark, the `┼` of an ER cardinality, or a mark's fan forking a heavy trunk into light
// legs, which no two unrelated strokes ever draw.
const meant = (ch: string, owner: string): boolean => {
  const arms = armsOf(ch) ?? [];
  return ownerOf(owner) === ARROW || (arms.some((arm) => arm === LIGHT) && arms.some((arm) => arm > LIGHT));
};

// Two strokes never share a cell as a crossing: the one running on keeps it and the other is cut.
export function crossingBreaches(grid: readonly Cell[][]): Breach[] {
  const breaches: Breach[] = [];
  grid.forEach((cells, row) => {
    cells.forEach(({ ch, ground, owner }, col) => {
      if (CROSSINGS.has(ch) && !meant(ch, owner)) breaches.push({ row, col, ch, ground, wanted: "", owner });
    });
  });
  return breaches;
}

// Each side a cell looks out on, with the arm a stroke there reaches back in by.
const FACING: ReadonlyArray<readonly [number, number, number]> = [[0, -1, RIGHT], [0, 1, LEFT], [-1, 0, DOWN], [1, 0, UP]];

// A frame's title never covers a line: no stroke beside one of its cells reaches into it, as an edge cut by it would.
export function titleOverLineBreaches(grid: readonly Cell[][]): Breach[] {
  const breaches: Breach[] = [];
  grid.forEach((cells, row) => {
    cells.forEach(({ ch, ground, owner }, col) => {
      if (!ownerOf(owner).startsWith(SUBGRAPH_LABEL)) return;
      const reaching = FACING.find(([dr, dc, arm]) => armed(grid[row + dr]?.[col + dc], arm));
      if (reaching !== undefined) breaches.push({ row, col, ch, ground, wanted: "", owner: `${owner} under ${grid[row + reaching[0]][col + reaching[1]].owner}` });
    });
  });
  return breaches;
}
