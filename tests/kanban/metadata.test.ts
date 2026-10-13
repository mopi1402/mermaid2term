import { describe, expect, it } from "vitest";
import { render, renderThemedText } from "../../src/index.js";

const board = (...lines: string[]): string => ["kanban", ...lines].join("\n");
const rowsOf = (source: string, width: number): string[] => render(source, { width }).split("\n");
const rowWith = (rows: readonly string[], word: string): string => rows.find((row) => row.includes(word)) ?? "";

// Measured on mermaid 12.0.0 headless (2026-09-29): the `@{ }` block is read as YAML, `label` replaces the title,
// `ticket` and `assigned` sit on a line under it, left and right, and `icon`, classes and shapes draw nothing.
describe.each([40, 120])("a kanban card's metadata at width %i", (width) => {
  it("reads an inline block into a line under the title, ticket left and assigned right", () => {
    const rows = rowsOf(board("  Todo", "    a[Task A]@{ ticket: MC-1, assigned: knsv }"), width);
    const title = rows.findIndex((row) => row.includes("Task A"));
    expect(title).toBeGreaterThan(0);
    expect(rows[title + 1]).toMatch(/MC-1 +knsv/u);
    expect(rows.join("\n")).not.toContain("@{");
  });

  it("reads a block after a space, and a bare id's, quotes off", () => {
    const rows = rowsOf(board("  Todo", "    b[Task B] @{ assigned: 'kn sv' }", "    c@{ assigned: knsv }"), width);
    expect(rowWith(rows, "kn sv")).not.toContain("'");
    expect(rows.some((row) => /│ ?c +│/u.test(row) || /│c +│/u.test(row))).toBe(true);
    expect(rows.join("\n")).not.toContain("@{");
  });

  it("reads a block over several lines as one card", () => {
    const rows = rowsOf(board("  Todo", "    a[Task A]@{", "      assigned: knsv", "      ticket: MC-2", "    }", "    b[Next]"), width);
    const text = rows.join("\n");
    expect(text).not.toContain("assigned");
    expect(text).not.toMatch(/│ *\} *│/u);
    expect(rowWith(rows, "MC-2")).toContain("knsv");
    expect(text).toContain("Next");
  });

  it("reads a standalone block on a later line as a new card", () => {
    const rows = rowsOf(board("  Todo", "    id1[Task]", "    id2@{", "      assigned: knsv", "    }"), width);
    expect(rows.join("\n")).not.toContain("@{");
    expect(rowWith(rows, "knsv")).not.toContain("assigned");
    expect(rows.some((row) => row.includes("id2"))).toBe(true);
  });

  it("lets `label` replace a card's title and a column's", () => {
    const text = rowsOf(board("  Todo@{ label: 'Column X' }", "    a[Title]@{ label: 'Other' }", "  Done@{ label: Fin }"), width).join("\n");
    expect(text).toContain("Column X");
    expect(text).toContain("Other");
    expect(text).toContain("Fin");
    expect(text).not.toContain("Title");
    expect(text).not.toContain("label");
  });

  it("keeps an `@` inside a label", () => {
    expect(rowsOf(board("  Todo", "    b[mail me at x@y.z]"), width).join("\n")).toContain("mail me at x@y.z");
  });

  it("draws neither `icon` nor an unknown key", () => {
    const text = rowsOf(board("  Todo", "    c[x]@{ foo: bar, icon: heart }"), width).join("\n");
    expect(text).not.toContain("heart");
    expect(text).not.toContain("foo");
  });
});

describe.each([40, 120])("a kanban's decorations at width %i", (width) => {
  it("lays a class or an icon on its own line on no card", () => {
    const text = rowsOf(board("  Todo", "    a[x]", "    :::urgent", "    c[z]", "    ::icon(fa fa-book)", "    e[v]"), width).join("\n");
    expect(text).not.toContain("urgent");
    expect(text).not.toContain("icon");
    expect(text).not.toContain("book");
  });

  it("drops a class or an icon written after a bracket, the label kept", () => {
    const rows = rowsOf(board("  Todo", "    b[y]:::hot", "    d[w]::icon(fa fa-book)"), width);
    expect(rows.join("\n")).not.toMatch(/hot|icon|book|\[/u);
    expect(rowWith(rows, "y")).toMatch(/│ ?y +│/u);
    expect(rowWith(rows, "w")).toMatch(/│ ?w +│/u);
  });
});

describe.each([40, 120])("a kanban node's shapes and ids at width %i", (width) => {
  it("shows only the text of every mindmap shape, as mermaid 12 does", () => {
    const text = rowsOf(board("  Todo", "    a(round)", "    b((circle))", "    c))bang((", "    d)cloud(", "    e{{hex}}", "    f(-dashed-)", "  col(Round)", "    g[x]"), width).join("\n");
    for (const label of ["round", "circle", "bang", "cloud", "hex", "dashed-", "Round"]) expect(text).toContain(label);
    expect(text).not.toMatch(/[(){}]/u);
  });

  it("reads an id holding a dot or a space", () => {
    const text = rowsOf(board("  a.b[Todo]", "    t1[x]", "  my col[Doing]", "    my task", "    t.2[y]"), width).join("\n");
    expect(text).toContain("Todo");
    expect(text).toContain("Doing");
    expect(text).toContain("my task");
    expect(text).not.toMatch(/a\.b|my col|t\.2|\[/u);
  });

  it("reads a statement on the header line as the first column", () => {
    const rows = rowsOf(board().replace("kanban", "kanban Todo") + "\n  a[x]\n  Done", width);
    expect(rows.some((row) => /│ +Todo +│/u.test(row))).toBe(true);
    expect(rows.some((row) => /│ ?Done *│/u.test(row))).toBe(true);
  });
});

// mermaid's `kanbanItem` strokes a 4px line down the card's left side: red, orange, blue, lightblue for `Very High`,
// `High`, `Low`, `Very Low`, none for `Medium` or any other word; here the card's left wall, heavy and in that colour.
describe.each([40, 120])("a kanban card's priority at width %i", (width) => {
  const source = board("  Todo", ...[["a", "Very High"], ["b", "High"], ["c", "Medium"], ["d", "Low"], ["e", "Very Low"], ["f", "low"]].map(([id, said]) => `    ${id}[${id.toUpperCase()}]@{ priority: '${said}' }`));
  const wallOf = (label: string): { ch: string; style: string } => {
    const rows = renderThemedText(source, { width, background: "light" }, "default").rows;
    const row = rows.find((cells) => cells.map((cell) => cell.ch).join("").includes(`${label} `)) ?? [];
    const at = row.findIndex((cell, i) => cell.ch === label && i > 0);
    return row[at - 1] ?? { ch: "", style: "" };
  };

  it.each([["A", "#FF0000"], ["B", "#FFA500"], ["D", "#0000FF"], ["E", "#ADD8E6"]])("inks card %s's left wall", (label, ink) => {
    const wall = wallOf(label);
    expect(wall.ch).toBe("┃");
    expect(wall.style.toUpperCase()).toMatch(new RegExp(`^${ink}\\b`, "u"));
  });

  it.each([["C"], ["F"]])("leaves card %s's wall as it is", (label) => {
    expect(wallOf(label).ch).toBe("│");
  });

  it("keeps the words of the priority off the card", () => {
    expect(render(source, { width })).not.toMatch(/High|Low|Medium|priority/u);
  });
});
