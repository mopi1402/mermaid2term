import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { must } from "../../src/must.js";
import { UNICODE } from "../../src/canvas/charsets.js";

const END = UNICODE.framedCircle;
const START = "●";
const WIDTHS = [40, 60, 80, 120];

const COMPOSITION = readFileSync("fixtures/state/composition.mmd", "utf8");
const across = (source: string): string => source.replace("stateDiagram-v2", "stateDiagram-v2\n    direction LR");
const down = (source: string): string => source.replace("stateDiagram-v2", "stateDiagram-v2\n    direction TB");

// Two composites of uneven height fed by one start: the second leg once lost its corner and began in the void.
const UNEVEN = `stateDiagram-v2
[*] --> First
state First {
  a --> b
}
[*] --> Second
state Second {
  c --> Nested
  state Nested {
    x --> y
  }
}
`;

// A three-level composite whose scope carries marks while the root does too: they once fell into the deepest box.
const DEEP = `stateDiagram-v2
[*] --> Release
state Release {
  [*] --> Staging
  state Staging {
    state Checks {
      Unit --> Integration : green
    }
  }
  Staging --> Production : promote
  Production --> [*]
}
Release --> [*]
`;

const cells = (row: string): string[] => [...row];
const lastIndex = (rows: string[], wanted: (row: string, at: number) => boolean): number => {
  for (let at = rows.length - 1; at >= 0; at--) if (wanted(rows[at], at)) return at;
  return -1;
};
const firstInk = (row: string): string | undefined => cells(row).find((ch) => ch !== " ");

// The columns of the wall pair a title stands between, found on the title's own row.
function wallsAround(rows: string[], title: string): { row: number; left: number; right: number } {
  const row = rows.findIndex((r) => r.includes(title));
  const line = cells(rows[row]);
  const at = line.join("").indexOf(title);
  const start = [...line.join("").slice(0, at)].length;
  let left = start;
  while (left >= 0 && line[left] !== "│") left--;
  let right = start + title.length;
  while (right < line.length && line[right] !== "│") right++;
  return { row, left, right };
}

describe("the runs leaving a start mark reach every composite it feeds", () => {
  it.each(WIDTHS)("never begins a run in an empty cell, across the page, at width %i", (width) => {
    for (const source of [UNEVEN, across(COMPOSITION), across(DEEP)]) {
      const rows = render(source, { width }).split("\n");
      expect(rows.filter((row) => firstInk(row) === "─")).toEqual([]);
    }
  });

  it("seats the start between two composites of uneven height, on its double trunk", () => {
    expect(render(across(UNEVEN), { width: 80 })).toMatch(/^●═╡/mu);
    expect(render(across(COMPOSITION), { width: 80 })).toMatch(/^●═╡/mu);
  });

  it("forks the trunk to the middle of each box it feeds, down the page", () => {
    const rows = render(down(COMPOSITION), { width: 80 }).split("\n");
    const heads = cells(rows[4]).flatMap((ch, col) => (ch === "⏷" ? [col] : []));
    expect(heads).toHaveLength(2);
    const first = wallsAround(rows, "First");
    const other = wallsAround(rows, "Another Composite");
    expect(Math.abs(heads[0] - (first.left + first.right) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(heads[1] - (other.left + other.right) / 2)).toBeLessThanOrEqual(1);
  });
});

describe("the marks of a composite stay in the composite they belong to", () => {
  it.each([across, down])("keeps the scope's marks out of the boxes nested in it (%#)", (turn) => {
    const rows = render(turn(DEEP), { width: 80 }).split("\n");
    const checks = wallsAround(rows, "Checks");
    const floor = rows.findIndex((row, at) => at > checks.row && cells(row)[checks.left] === "╘");
    for (let at = checks.row; at <= floor; at++) {
      const inside = cells(rows[at]).slice(checks.left + 1, checks.right);
      expect(inside.filter((ch) => ch === START || ch === END)).toEqual([]);
    }
  });

  it("chains a scope's start, its nested composites and its end in that order, across the page", () => {
    const drawn = render(across(DEEP), { width: 80 });
    expect(drawn).toMatch(/●─+⏵│ ●─+⏵│/u);
    expect(drawn).toMatch(new RegExp(String.raw`Production\s+├─+⏵${END}\s+│`, "u"));
  });
});

describe("a composite lines its content up on its own middle, as mermaid seats it", () => {
  it.each([80, 120])("centres the start, the state, the nested box and the end down the page, at width %i", (width) => {
    const rows = render(down(COMPOSITION), { width }).split("\n");
    const outer = wallsAround(rows, "Another Composite");
    const nested = wallsAround(rows, "Nested");
    expect(Math.abs(nested.left - outer.left - (outer.right - nested.right))).toBeLessThanOrEqual(1);

    const middle = (outer.left + outer.right) / 2;
    const below = rows.slice(outer.row + 1);
    const start = must(below.find((row) => cells(row).slice(outer.left + 1, outer.right).includes(START)));
    const startCol = cells(start).indexOf(START, outer.left + 1);
    const end = must(below.find((row) => cells(row).slice(outer.left + 1, outer.right).includes(END)));
    const endCol = cells(end).indexOf(END, outer.left + 1);
    const simple = must(below.find((row) => row.includes("Another simple")));
    const simpleAt = [...simple.slice(0, simple.indexOf("Another simple"))].length + "Another simple".length / 2;
    for (const col of [startCol, endCol, simpleAt]) expect(Math.abs(col - middle)).toBeLessThanOrEqual(1);
  });

  it("runs the nested box's exit straight down onto the end mark", () => {
    const rows = render(down(COMPOSITION), { width: 80 }).split("\n");
    const end = lastIndex(rows, (row) => row.includes(END));
    const col = cells(rows[end]).lastIndexOf(END);
    expect(cells(rows[end - 1])[col]).toBe("⏷");
    const floor = lastIndex(rows, (row, at) => at < end && cells(row)[col] === "┬");
    for (let at = floor + 1; at < end - 1; at++) expect(cells(rows[at])[col]).toBe("│");
  });

  it("keeps the nested box after the state that enters it, across the page", () => {
    const drawn = render(across(COMPOSITION), { width: 80 });
    expect(drawn).toMatch(new RegExp(String.raw`●─+⏵│\s+Another simple\s+├─+⏵│ │\s+check\s+├─+⏵│\s+sign\s+│ ├─+⏵${END}`, "u"));
  });
});
