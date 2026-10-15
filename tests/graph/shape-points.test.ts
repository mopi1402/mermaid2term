import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { must } from "../../src/must.js";

describe("a flag's notch, cut out of the interior and not the frame", () => {
  const TIP = "\u27e9";
  const flag = (source: string, options = {}): string[] => render(source, { width: 60, ...options }).split("\n");

  it("runs both rules the full width, corner to left edge", () => {
    const rows = flag("flowchart LR\n    id1>This is the text in the box]");
    expect(rows[0]).toMatch(/^─+┐$/u);
    expect(must(rows.at(-1))).toMatch(/^─+┘$/u);
  });

  it("closes the chevron on a column INSIDE the left edge", () => {
    const rows = flag("flowchart LR\n    id1>This is the text in the box]");
    expect(rows[1]).toStartWith("\\");
    expect(rows[2]).toStartWith(` ${TIP}`);
    expect(rows[3]).toStartWith("/");
  });

  it("keeps the name clear of the tip", () => {
    const rows = flag("flowchart LR\n    a>drapeau]");
    expect(rows[2]).toStartWith(` ${TIP} `);
  });

  it("keeps the notch on the LEFT under RL, a shape being a shape whichever way the graph runs", () => {
    const rows = flag("flowchart RL\n    a>drapeau]");
    expect(rows[1]).toStartWith("\\");
    expect(rows[2]).toStartWith(" \u27e9");
    expect(rows[3]).toStartWith("/");
    expect(rows.join("\n")).not.toContain("\u27e8");
  });
});

describe("a hexagon drawn to a point and not as a chipped rectangle", () => {
  const RISE = "\u2571";
  const FALL = "\u2572";
  const POINT_LEFT = "\u27e8";
  const POINT_RIGHT = "\u27e9";
  const FLOOR = "\u2581";
  const CEILING = "\u2594";
  const hex = (source: string, options = {}): string[] => render(source, { width: 60, ...options }).split("\n");

  it("points each side on the box's own edge, the waist alone as wide as the block", () => {
    const rows = hex("flowchart LR\n    id1{{This is the text in the box}}");
    const waist = rows.findIndex((row) => row.startsWith(POINT_LEFT));
    expect(waist).toBeGreaterThan(0);
    expect(rows[waist]).toEndWith(POINT_RIGHT);
    for (const [at, row] of rows.entries()) {
      if (at === waist) continue;
      expect(row.startsWith(POINT_LEFT)).toBe(false);
      expect(row.trimEnd().length).toBeLessThan(rows[waist].length);
    }
  });

  it("rises above the waist and falls below it, one column in on each side", () => {
    const rows = hex("flowchart LR\n    id1{{hexagone}}");
    const waist = rows.findIndex((row) => row.startsWith(POINT_LEFT));
    expect(rows[waist - 1]).toMatch(new RegExp(`^ ${RISE}.*${FALL}$`, "u"));
    expect(rows[waist + 1]).toMatch(new RegExp(`^ ${FALL}.*${RISE}$`, "u"));
  });

  it("writes each flat on the LINE the slopes end at, and not a half row away from it", () => {
    const rows = hex("flowchart LR\n    id1{{hexagone}}");
    expect(rows[0]).toMatch(new RegExp(`^ +${FLOOR}+ *$`, "u"));
    expect(must(rows.at(-1))).toMatch(new RegExp(`^ +${CEILING}+ *$`, "u"));
  });

  it("stands level with the boxes beside it at every height, each flat on a row of its own", () => {
    for (const direction of ["LR", "TD"]) {
      const rows = hex(`flowchart ${direction}\n    a{{x}}`, { paddingX: 0, paddingY: 0, gap: 1 });
      expect(rows).toEqual([` ${FLOOR}${FLOOR}${FLOOR}`, `${POINT_LEFT} x ${POINT_RIGHT}`, ` ${CEILING}${CEILING}${CEILING}`]);
    }
  });

  it("meets its two slopes between the rows where the box has an EVEN height, and no point", () => {
    for (const direction of ["LR", "TD"]) {
      const four = hex(`flowchart ${direction}\n    a{{hexagone}}`, { paddingY: 1 });
      expect(four).toHaveLength(4);
      expect(four[0]).toMatch(new RegExp(`^ ${FLOOR}+$`, "u"));
      expect(four[1]).toMatch(new RegExp(`^${RISE}   hexagone   ${FALL}$`, "u"));
      expect(four[2]).toMatch(new RegExp(`^${FALL} +${RISE}$`, "u"));
      expect(four[3]).toMatch(new RegExp(`^ ${CEILING}+$`, "u"));
      const six = hex(`flowchart ${direction}\n    a{{hexagone}}`, { paddingY: 3 });
      expect(six).toHaveLength(6);
      expect(six[0]).toMatch(new RegExp(`^  ${FLOOR}+$`, "u"));
      expect(six[1]).toMatch(new RegExp(`^ ${RISE} +${FALL}$`, "u"));
      expect(six[2]).toMatch(new RegExp(`^${RISE}   hexagone   ${FALL}$`, "u"));
      expect(six[3]).toMatch(new RegExp(`^${FALL} +${RISE}$`, "u"));
      expect(six[4]).toMatch(new RegExp(`^ ${FALL} +${RISE}$`, "u"));
      expect(six[5]).toMatch(new RegExp(`^  ${CEILING}+$`, "u"));
      expect(six.join("\n")).not.toMatch(new RegExp(`[${POINT_LEFT}${POINT_RIGHT}]`, "u"));
    }
  });

  it("reserves the two columns its slopes take, so a wrapped name keeps clear of them", () => {
    const rows = hex("flowchart LR\n    id1{{This is the text in the box}}");
    for (const row of rows) expect(row).not.toMatch(/[A-Za-z][\u2571\u2572]/u);
  });

  it("turns its slopes round with the canvas", () => {
    const opens = new RegExp(`${RISE}[^${RISE}${FALL}]*${FALL}`, "u");
    const closes = new RegExp(`${FALL}[^${RISE}${FALL}]*${RISE}`, "u");
    for (const direction of ["RL", "BT"]) {
      const rows = hex(`flowchart ${direction}\n    a{{hexagone}} --> b[boite]`);
      const waist = rows.findIndex((row) => row.includes(POINT_LEFT));
      expect(rows[waist - 1]).toMatch(opens);
      expect(rows[waist + 1]).toMatch(closes);
      expect(rows[waist - 2]).toContain(FLOOR);
      expect(rows[waist + 2]).toContain(CEILING);
    }
  });
});

describe("a flag's notch on an EVEN count of rows, two slopes meeting between them", () => {
  it("draws `\\` over `/` and no tip where the box has no middle row, upright and across", () => {
    for (const direction of ["LR", "TD"]) {
      for (const [paddingY, height] of [
        [1, 4],
        [3, 6],
      ] as const) {
        const rows = render(`flowchart ${direction}\n    a>flag]`, { width: 60, paddingY }).split("\n");
        expect(rows).toHaveLength(height);
        for (let r = 1; r < height - 1; r++) expect(rows[r][0]).toBe(r < height / 2 ? "\\" : "/");
        expect(rows.join("\n")).not.toContain("\u27e9");
      }
    }
  });

  it("keeps its tip on a box of an odd height, where the middle row is there to carry it", () => {
    const rows = render("flowchart LR\n    a>flag]", { width: 60 }).split("\n");
    expect(rows).toHaveLength(5);
    expect(rows[2]).toMatch(/^ \u27e9\s+flag\s+│$/u);
  });
});

describe("the four SHEARED shapes, sheared and not a rectangle with a slash in each corner", () => {
  const RISE = "\u2571";
  const FALL = "\u2572";
  const FLOOR = "\u2581";
  const CEILING = "\u2594";
  const shape = (written: string, options = {}): string[] =>
    render(`flowchart TD\n    id1[${written}]`, { width: 60, ...options }).split("\n");
  const edges = (row: string): [number, number] => [
    Math.min(row.indexOf(RISE) < 0 ? row.length : row.indexOf(RISE), row.indexOf(FALL) < 0 ? row.length : row.indexOf(FALL)),
    Math.max(row.lastIndexOf(RISE), row.lastIndexOf(FALL)),
  ];

  const LEANS: ReadonlyArray<readonly [string, string, string, string]> = [
    ["parallelogram", "/Parallelogram/", RISE, RISE],
    ["parallelogram alt", "\\Parallelogram alt\\", FALL, FALL],
    ["trapezoid", "/Trapezoid\\", RISE, FALL],
    ["trapezoid alt", "\\Trapezoid alt/", FALL, RISE],
  ];

  it.each(LEANS)("leans a %s the way its delimiters do, on every row", (_name, written, left, right) => {
    const rows = shape(written);
    for (const row of rows) {
      const [from, to] = edges(row);
      expect(row[from]).toBe(left);
      expect(row[to]).toBe(right);
    }
  });

  it.each(LEANS)("carries a %s a column per row, so the two flats end up offset by the height", (_name, written) => {
    const rows = shape(written);
    const [top] = edges(rows[0]);
    const [foot] = edges(must(rows.at(-1)));
    expect(rows).toHaveLength(5);
    expect(Math.abs(top - foot)).toBe(4);
  });

  it.each(LEANS)("closes a %s with a flat on the line its slopes reach", (_name, written) => {
    const rows = shape(written);
    expect(rows[0]).toContain(CEILING);
    expect(must(rows.at(-1))).toContain(FLOOR);
    for (const row of rows.slice(1, -1)) {
      expect(row).not.toContain(CEILING);
      expect(row).not.toContain(FLOOR);
    }
  });

  it.each(LEANS)("keeps a %s's name off its slopes", (_name, written) => {
    for (const row of shape(written)) expect(row).not.toMatch(/[A-Za-z][\u2571\u2572]|[\u2571\u2572][A-Za-z]/u);
  });

  it("floors a trapezoid wider than a parallelogram, its short flat costing twice the shear", () => {
    const tight = { paddingX: 0, gap: 1 };
    for (const written of ["/Trapezoid\\", "\\Trapezoid alt/"]) {
      for (const row of shape(written, tight)) {
        const [from, to] = edges(row);
        expect(to).toBeGreaterThan(from);
      }
    }
  });

  it("keeps the lean under BT and RL: a trapezoid narrow at the top stays narrow at the top", () => {
    const down = render("flowchart TD\n    a[boite] --> b[/Trapezoid\\]", { width: 60 }).split("\n");
    const up = render("flowchart BT\n    a[boite] --> b[/Trapezoid\\]", { width: 60 }).split("\n");
    const first = (rows: string[]): string => must(rows.find((row) => row.includes(RISE) || row.includes(FALL)));
    expect(first(down)[edges(first(down))[0]]).toBe(RISE);
    expect(first(up)[edges(first(up))[0]]).toBe(RISE);
    const lr = render("flowchart LR\n    a[/Para/] --> b[boite]", { width: 60 }).split("\n");
    const rl = render("flowchart RL\n    a[/Para/] --> b[boite]", { width: 60 }).split("\n");
    for (const drawn of [lr, rl]) {
      expect(drawn.join("\n")).toContain(RISE);
      expect(drawn.join("\n")).not.toContain(FALL);
    }
  });

  it("reserves the shear in a BLOCK diagram too, which sizes itself apart from the flowchart", () => {
    const drawn = render('block-beta\n    columns 2\n    a[/"parallelogram"/] b["plain"]\n', { width: 80 });
    for (const row of drawn.split("\n")) expect(row).not.toMatch(/[A-Za-z][\u2571\u2572]|[\u2571\u2572][A-Za-z]/u);
  });
});
