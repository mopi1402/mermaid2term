import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { must } from "../../src/must.js";

const rowsOf = (drawn: string): string[] => drawn.split("\n");

describe("class edges that were drawn over the diagram instead of beside it", () => {
  it("loops a relation from a class to ITSELF outside the box, where the shaft used to cut through it", () => {
    const rows = rowsOf(render("classDiagram\n    direction TB\n    class E {\n        +go()\n    }\n    E --> E : retry\n", { width: 70 }));
    const top = must(rows.find((row) => row.includes("┌─")));
    const wall = top.indexOf("┐");
    // Every row of the box keeps its two walls: nothing of the relation stands between them.
    for (const row of rows.filter((r) => r.includes("│") || r.includes("├"))) {
      expect(row.slice(0, wall + 1), row).toMatch(/^\s*[│├└┌].*[│├┤┘┐]$/u);
    }
    const drawn = rows.join("\n");
    expect(drawn).toMatch(/├─┐/u);
    expect(drawn).toMatch(/│⏴┘/u);
    expect(drawn).toContain("retry");
    // The label and the two columns the loop rides are room the layout gave it, not the neighbour's.
    const wide = render("classDiagram\n    direction TB\n    A --> A : again\n    class B\n", { width: 80 });
    expect(wide).toMatch(/─┐\s+┌/u);
    expect(wide).toContain("again");
  });

  it("keeps a class whose neighbour takes the room its own note wanted", () => {
    const drawn = render(
      'classDiagram\n    direction TB\n    class A\n    class B\n    note for A "note one"\n    note for B "note two"\n',
      { width: 100 }
    );
    for (const name of ["A", "B", "note one", "note two"]) expect(drawn).toContain(name);
    const rows = rowsOf(drawn);
    // Both class headers are still on the one row they were laid on, neither painted over by a note box.
    const heads = must(rows.find((row) => row.includes("note one")));
    expect(heads).toMatch(/note one\s+│┄+│\s+A\s+│\s+│\s+B\s+│┄+│ note two/u);
    // A third note has nowhere left on that row and drops to one of its own, tethered by an elbow.
    const three = render(
      'classDiagram\n    direction TB\n    class A\n    class B\n    class C\n    note for A "one"\n    note for B "two"\n    note for C "three"\n',
      { width: 120 }
    );
    expect(three).toContain("two");
    expect(rowsOf(three).filter((row) => row.includes("┊"))).not.toHaveLength(0);
  });

  it("gives two relations between the SAME pair two shafts, two heads and two labels", () => {
    const rows = rowsOf(render("classDiagram\n    direction TB\n    F --> G : one\n    F --> G : two\n", { width: 60 }));
    const heads = must(rows.find((row) => row.includes("⏷")));
    expect([...heads].filter((ch) => ch === "⏷")).toHaveLength(2);
    const drawn = rows.join("\n");
    expect(drawn).not.toContain("onetwo");
    expect(drawn).toContain("one");
    expect(drawn).toContain("two");
    // No corner at all: the two shafts leave and land apart, so neither has to bend.
    expect(drawn).not.toMatch(/[└┘]\s*[┌┐]/u);
    const three = render(
      "classDiagram\n    direction TB\n    F --> G : creates the order\n    F ..> G : reads the order\n    F --> G : third\n",
      { width: 80 }
    );
    for (const label of ["creates the order", "reads the order", "third"]) expect(three).toContain(label);
    expect(three).not.toContain("creates the orthird");
  });

  it("gives every edge of a fan its own turn row, where six corners were drawn over each other", () => {
    const source =
      "classDiagram\n    direction TB\n" +
      ["A1", "B1", "C1", "D1", "E1", "F1"].map((to, i) => `    Hub --> ${to} : ${"abcdef"[i]}\n`).join("");
    const rows = rowsOf(render(source, { width: 120 }));
    const drawn = rows.join("\n");
    for (const label of ["a", "b", "c", "d", "e", "f"]) expect(drawn).toContain(label);
    expect([...must(rows.find((row) => row.includes("⏷")))].filter((ch) => ch === "⏷")).toHaveLength(6);
    // Two corners on one row, with nothing but rule between them, is one turn drawn over another.
    for (const row of rows) expect(row, row).not.toMatch(/┌─+┌/u);
    for (const row of rows) expect(row, row).not.toMatch(/┐─+┐/u);
    // A fork whose two halves go opposite ways still turns on one row, and spends no extra one.
    const fork = rowsOf(render("classDiagram\n    direction TB\n    P --> Q\n    P --> R\n", { width: 60 }));
    const floor = fork.findIndex((row) => row.includes("└──"));
    expect(fork[floor + 1]).toMatch(/│ │/u);
    expect(fork[floor + 2]).toMatch(/╭─+╯ ╰─+╮/u);
  });
});
