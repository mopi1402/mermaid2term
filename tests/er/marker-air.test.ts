import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { THREE_PANES, TWO_PANES } from "../support/drawn.js";
import { corpus, DRAWN } from "../../scripts/corpus.js";

// Two cardinality figures one blank column apart read as a single bar, and none apart as one figure: mermaid keeps
// the ends of a face well apart.
const FIGURE = String.raw`(?:═╪═|[╭╰][●┼][╮╯])`;
const CRAMPED = new RegExp(`${FIGURE} {0,2}${FIGURE}`, "u");

const SOURCES = corpus(DRAWN)
  .map(({ id, source }) => ({ name: id, source }))
  .filter(({ source }) => source.trimStart().startsWith("erDiagram"));

const LINES = readFileSync("fixtures/er/relationship-lines.mmd", "utf8");
const across = (source: string): string => source.replace("erDiagram", "erDiagram\n    direction LR");

describe("the cardinality figures on one face of an entity stand apart", () => {
  it.each(THREE_PANES)("keeps three blank columns between two figures down the page, at width %i", (width) => {
    for (const { name, source } of SOURCES) {
      const cramped = render(source, { width }).split("\n").filter((row) => CRAMPED.test(row));
      expect({ name, cramped }).toEqual({ name, cramped: [] });
    }
  });

  it.each(THREE_PANES)("parts the three ends leaving ORDER evenly, at width %i", (width) => {
    expect(render(LINES, { width })).toContain("═╪═   ═╪═   ═╪═");
  });

  it.each(THREE_PANES)("keeps every figure a column of wall clear of the corner, at width %i", (width) => {
    for (const { name, source } of SOURCES) {
      const hugging = render(source, { width }).split("\n").filter((row) => /[┌└┏┗][┬┴┯┷]|[┬┴┯┷][┐┘┓┛]/u.test(row));
      expect({ name, hugging }).toEqual({ name, hugging: [] });
    }
  });

  // Packed by their left ends alone, carries and employs once crossed twice where the other order never meets.
  it.each(THREE_PANES)("seats the runs of one band so no two of them cross, at width %i", (width) => {
    const rows = render(LINES, { width }).split("\n").map((row) => [...row]);
    const run = (ch: string | undefined): boolean => ch !== undefined && "─┄".includes(ch);
    const crossings = rows.flatMap((row) => row.filter((ch, col) => ch === "┼" && run(row[col - 1]) && run(row[col + 1])));
    expect(crossings).toEqual([]);
  });

  it("keeps a blank row between two figures on one face across the page", () => {
    const rows = render(across(LINES), { width: 120 }).split("\n");
    const wall = [...rows[1]].indexOf("├") + 1;
    const marked = rows.flatMap((row, at) => ([...row][wall] === "╫" ? [at] : []));
    expect(marked.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < marked.length; i++) expect(marked[i] - marked[i - 1]).toBeGreaterThanOrEqual(2);
  });
});

// The box a name stands in: the columns of its walls and the row of its lid.
function boxOf(rows: string[], name: string): { left: number; right: number; top: number } {
  const top = rows.findIndex((row) => row.includes(` ${name} `)) - 1;
  const row = [...rows[top + 1]];
  const at = [...rows[top + 1].slice(0, rows[top + 1].indexOf(` ${name} `))].length;
  let left = at;
  while (row[left] !== "│") left--;
  let right = at + name.length + 1;
  while (row[right] !== "│" && row[right] !== "├") right++;
  return { left, right, top };
}

describe("schemas no relation joins keep a zone each", () => {
  it.each([80, 120])("stands TEAM over EMPLOYEE, the schema apart from ORDER's, at width %i", (width) => {
    const rows = render(LINES, { width }).split("\n");
    const team = boxOf(rows, "TEAM");
    const employee = boxOf(rows, "EMPLOYEE");
    expect(Math.abs(team.left + team.right - employee.left - employee.right)).toBeLessThanOrEqual(2);
    const note = boxOf(rows, "NOTE");
    const shipment = boxOf(rows, "SHIPMENT");
    expect(employee.left - note.right).toBeGreaterThan(note.left - shipment.right);
  });

  it("keeps both labels between TEAM and EMPLOYEE whole when their lines drop side by side", () => {
    const drawn = render(LINES, { width: 40 });
    expect(drawn).toContain("employs");
    expect(drawn).toContain("is led by");
  });

  it("keeps TEAM and EMPLOYEE on one band across the page", () => {
    const rows = render(across(LINES), { width: 120 }).split("\n");
    const team = rows.findIndex((row) => row.includes(" TEAM "));
    expect(rows[team]).toContain(" EMPLOYEE ");
  });
});

// The loop once counted the ends on EMPLOYEE's other faces as standing on its floor, and fled left through a label.
describe("a self relation loops on the right flank when the floor is free", () => {
  it.each([
    ["down the page", (source: string): string => source],
    ["across the page", across],
  ])("keeps the manages loop right of EMPLOYEE, its label inside it, %s", (_, turn) => {
    for (const width of THREE_PANES) {
      const drawn = render(turn(LINES), { width });
      expect(drawn).toMatch(/EMPLOYEE\s*├╫─+╮/u);
      expect(drawn).toMatch(/╰── manages ─╯/u);
      expect(drawn).toContain("is led by");
    }
  });
});

const turn = (dir: string) => (source: string): string => source.replace("erDiagram", `erDiagram\n    direction ${dir}`);

// Turned upside down or mirrored, the loop once kept to the floor and the right flank, where TEAM's lines come in.
describe("a self relation loops on the faces no other relation takes", () => {
  it.each(TWO_PANES)("comes back from above when TEAM's lines come in from below, bottom to top, at width %i", (width) => {
    const rows = render(turn("BT")(LINES), { width }).split("\n");
    expect(rows[0]).toMatch(/╭── manages ─╮/u);
    const drawn = rows.join("\n");
    expect(drawn).toContain("employs");
    expect(drawn).toContain("is led by");
  });

  it.each(TWO_PANES)("leaves by the left flank when TEAM faces the right one, right to left, at width %i", (width) => {
    const drawn = render(turn("RL")(LINES), { width });
    expect(drawn).toMatch(/╭─+╫┤\s*EMPLOYEE/u);
    expect(drawn).toMatch(/╰── manages ─╯/u);
    expect(drawn).toContain("is led by");
  });
});

// A label a short vertical run could not carry once sat on the box that run leaves, `└───────teaches`.
describe("a relation's label never sits on a box", () => {
  it("hangs the label beside a short run that hugs its box, across the page", () => {
    const words = readFileSync("fixtures/er/cardinality-in-words.mmd", "utf8");
    const rows = render(across(words), { width: 40 }).split("\n");
    const teacher = rows.findIndex((row) => row.includes("│TEACHER├"));
    expect(rows[teacher + 1]).toMatch(/^└───────┘/u);
    expect(rows.join("\n")).toContain("teaches");
  });
});

