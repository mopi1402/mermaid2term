import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";

describe("a destroyed participant leaves by its FOOT BOX on the destroying message, not by a bare cross", () => {
  const source =
    "sequenceDiagram\n    participant A\n    participant B\n    A->>B: hello\n    destroy B\n    B-->>A: bye\n";

  it("remounts the box onto the destroying message, the arrow meeting its edge, no cross anywhere", () => {
    const rows = render(source, { width: 80 }).split("\n");
    expect(rows.join("\n")).not.toContain("╳");
    const arrow = rows.findIndex((row) => row.includes("⏴"));
    expect(arrow).toBeGreaterThan(0);
    expect(rows[arrow]).toMatch(/⏴┄+│\s+B\s+│/u);
    expect(rows[arrow - 1]).toContain("╭");
    expect(rows[arrow + 1]).toContain("╰");
  });

  it("stops the dead lifeline at the box and lets the living one run past it", () => {
    const rows = render(source, { width: 80 }).split("\n");
    const arrow = rows.findIndex((row) => row.includes("⏴"));
    const column = rows[1].lastIndexOf("B");
    const below = rows.slice(arrow + 2).join("\n");
    expect(below).toContain("│");
    for (const row of rows.slice(arrow + 2)) expect(row[column] ?? " ").toBe(" ");
  });

  it("names it ONCE more and no more, the header keeping its own box", () => {
    const rows = render(source, { width: 80 });
    expect(rows.split("\n").filter((row) => /│\s+B\s+│/u.test(row)).length).toBe(2);
  });

  it("keeps a box of its own where no message follows the destroy", () => {
    const dangling = render("sequenceDiagram\n    participant A\n    participant B\n    A->>B: hello\n    destroy B\n", {
      width: 80,
    });
    expect(dangling).not.toContain("╳");
    expect(dangling.split("\n").filter((row) => /│\s+B\s+│/u.test(row)).length).toBe(2);
  });

  it("spends the rows on the box and not on a participant that lives, whose lifeline runs to the end", () => {
    const alive = render("sequenceDiagram\n    participant A\n    participant B\n    A->>B: hello\n", { width: 80 });
    expect(alive.split("\n").filter((row) => /│\s+B\s+│/u.test(row)).length).toBe(1);
  });
});

describe("a CREATED participant appears on the row it is created on and not in the header", () => {
  const source =
    "sequenceDiagram\n    A->>B: hello\n    create participant C\n    A->>C: hi C\n    C-->>A: hi back\n";

  it("seats the box on the creating message, the arrow meeting its edge, and nowhere in the header", () => {
    const rows = render(source, { width: 80 }).split("\n");
    const arrow = rows.findIndex((row) => /⏵│\s*C\s*│/u.test(row));
    expect(arrow).toBeGreaterThan(0);
    expect(rows[arrow - 1]).toContain("╭");
    expect(rows[arrow + 1]).toContain("╰");
    expect(rows.filter((row) => /│\s*C\s*│/u.test(row)).length).toBe(1);
  });

  it("drops the lifeline from under the mark and leaves the column clear above it", () => {
    const rows = render(source, { width: 80 }).split("\n");
    const arrow = rows.findIndex((row) => /⏵│\s*C\s*│/u.test(row));
    const column = rows[arrow].indexOf("C", rows[arrow].indexOf("⏵"));
    for (const row of rows.slice(0, arrow - 1)) expect(row[column] ?? " ").toBe(" ");
    expect(rows.slice(arrow + 2).some((row) => (row[column] ?? " ") === "│")).toBe(true);
  });

  it("keeps its place in the header where no message follows the create", () => {
    const rows = render("sequenceDiagram\n    A->>B: hello\n    create participant C\n", { width: 80 }).split("\n");
    expect(rows[1]).toMatch(/│\s*C\s*│/u);
  });

  it("spends no header row on a participant created later, an actor taking the header's height with everyone else", () => {
    const late = render("sequenceDiagram\n    A->>B: hi\n    create actor D as Donald\n    B->>D: hey\n", {
      width: 80,
    }).split("\n");
    expect(late[0]).toContain("╭");
    const figure = late.findIndex((row) => row.includes("─┼─"));
    expect(figure).toBeGreaterThan(3);
    expect(late[figure + 1]).toContain("/ \\");
    expect(late[figure + 2]).toContain("Donald");
    expect(late[figure]).toMatch(/⏵\s─┼─/u);
  });

  it("reads the kind and the alias of a created participant, `create actor D as Donald`", () => {
    const rows = render("sequenceDiagram\n    A->>B: hi\n    create actor D as Donald\n    B->>D: hey\n", {
      width: 80,
    });
    expect(rows).toContain("Donald");
    expect(rows).not.toMatch(/│\s*D\s*│/u);
  });
});

describe("`mirrorActors`, the participants repeated at the FOOT where a sequence overflows its height", () => {
  const SOURCE = [
    "sequenceDiagram",
    "    participant C as Client",
    "    participant A as Auth",
    "    C->>A: login",
    "    create participant S as Session",
    "    A->>S: open",
    "    S-->>C: cookie",
    "    C->>S: logout",
    "    destroy S",
    "    S-->>C: bye",
  ].join("\n");
  const names = (drawn: string, name: string): number => (drawn.match(new RegExp(name, "gu")) ?? []).length;

  it("repeats the standing participants under a drawing taller than its height, never a destroyed one", () => {
    const drawn = render(SOURCE, { width: 80, height: 8 });
    const rows = drawn.split("\n");
    expect(names(drawn, "Client")).toBe(2);
    expect(names(drawn, "Auth")).toBe(2);
    expect(rows.slice(-3).join("\n")).not.toContain("Session");
    expect(names(drawn, "Session")).toBe(2);
  });

  it("repeats nothing where no height was announced, or where the drawing fits it", () => {
    expect(names(render(SOURCE, { width: 80 }), "Client")).toBe(1);
    expect(names(render(SOURCE, { width: 80, height: 200 }), "Client")).toBe(1);
  });

  it("obeys the option written either way, the height notwithstanding", () => {
    expect(names(render(SOURCE, { width: 80, mirrorActors: true }), "Auth")).toBe(2);
    expect(names(render(SOURCE, { width: 80, height: 8, mirrorActors: false }), "Auth")).toBe(1);
  });
});
