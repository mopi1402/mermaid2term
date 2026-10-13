import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

const board = (...lines: string[]): string => ["kanban", ...lines].join("\n");
const rowsOf = (source: string, width: number): string[] => render(source, { width }).split("\n");
const cards = (rows: readonly string[]): number => rows.filter((row) => row.includes("┌")).length;

// Measured on mermaid 12.0.0 headless (2026-09-29): kanban's lexer is mindmap's, a string runs over line ends and
// only double quotes make one.
describe.each(TWO_PANES)("a kanban node read as mindmap's lexer reads it, at width %i", (width) => {
  it("keeps a quoted label spanning two lines as one card, a row per line", () => {
    const rows = rowsOf(board("  Todo", '    a["first', '    second"]', "    b[x]"), width);
    expect(cards(rows)).toBe(2);
    const first = rows.findIndex((row) => row.includes("first"));
    expect(rows[first + 1]).toContain("second");
    expect(rows.join("\n")).not.toContain('"');
  });

  it("keeps single quotes, which make no string there", () => {
    expect(rowsOf(board("  Todo", "    a['single']"), width).join("\n")).toContain("'single'");
  });

  it("keeps the quotes of a bare node, part of its id and label", () => {
    const text = rowsOf(board('  "Todo"', "    'a task'"), width).join("\n");
    expect(text).toContain('"Todo"');
    expect(text).toContain("'a task'");
  });
});
