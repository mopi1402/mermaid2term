import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";

describe("a DIVIDED rectangle, `div-rect`, drawn with its divider", () => {
  const one = (label: string, options = {}): string[] =>
    render(`flowchart TD\n    A@{ shape: div-rect, label: "${label}" }\n`, { width: 60, ...options }).split("\n");

  it.each(["div-rect", "div-proc", "divided-process", "divided-rectangle"])("answers to %s", (name) => {
    const rows = render(`flowchart TD\n    A@{ shape: ${name}, label: "Divided" }\n`, { width: 60 }).split("\n");
    expect(rows[1]).toBe(`├${"─".repeat(rows[0].length - 2)}┤`);
  });

  it("rules its band the full width, on the first row inside its own frame", () => {
    const rows = one("Divided process");
    expect(rows[0]).toStartWith("┌");
    expect(rows[1]).toStartWith("├");
    expect(rows[1]).toEndWith("┤");
    expect(rows[1]).toHaveLength(rows[0].length);
  });

  it("writes its name UNDER the band whatever the name costs in lines", () => {
    for (const [label, width] of [["Divided", 60], ["un nom assez long pour tenir sur trois lignes", 26]] as const) {
      const rows = render(`flowchart TD\n    A@{ shape: div-rect, label: "${label}" }\n`, { width }).split("\n");
      const named = rows.findIndex((row) => /[A-Za-z]/u.test(row));
      expect(named).toBeGreaterThan(1);
      expect(rows[1]).not.toMatch(/[A-Za-z]/u);
    }
  });

  it("keeps the band at the tightest padding, which is where a row has to be paid for", () => {
    const rows = one("Divided", { paddingY: 0 });
    expect(rows[1]).toStartWith("├");
    expect(rows.filter((row) => row.trim() !== "")).toHaveLength(4);
  });

  it("stands apart from the plain rectangle it used to be drawn as", () => {
    const plain = render(`flowchart TD\n    A[Divided]\n`, { width: 60 });
    expect(one("Divided").join("\n")).not.toBe(plain);
  });
});

describe("a CARD, `notch-rect`, a rectangle with its top left corner cut away", () => {
  const RISE = "\u2571";
  const RULE = "\u2581";
  const one = (options = {}): string[] =>
    render(`flowchart TD\n    A@{ shape: notch-rect, label: "Card" }\n`, { width: 60, ...options }).split("\n");

  it.each(["notch-rect", "card", "notched-rectangle"])("answers to %s", (name) => {
    const rows = render(`flowchart TD\n    A@{ shape: ${name}, label: "Card" }\n`, { width: 60 }).split("\n");
    expect(rows[0]).toContain(RULE);
    expect(rows[1]).toContain(RISE);
  });

  it("cuts the corner back two columns and picks the left side up on the row under the slope", () => {
    const rows = one();
    expect(rows[0].indexOf(RULE)).toBe(2);
    expect(rows[0].trimEnd()).toHaveLength(rows[2].length - 1);
    expect(rows[1].indexOf(RISE)).toBe(1);
    expect(rows[1]).not.toStartWith("│");
    expect(rows[2]).toStartWith("│");
    expect(rows[rows.length - 1]).toStartWith("└");
  });

  it("rules the top on the cell's FLOOR, so it lands on the line the slope climbs to", () => {
    const rows = one();
    expect(rows[0]).not.toContain("─");
    expect(rows[0]).toContain(RULE);
  });

  it("keeps its name off the slope's row whatever the name costs in lines", () => {
    for (const [label, width] of [["Card", 60], ["un nom assez long pour tenir sur trois lignes", 26]] as const) {
      const rows = render(`flowchart TD\n    A@{ shape: notch-rect, label: "${label}" }\n`, { width }).split("\n");
      expect(rows[1]).not.toMatch(/[A-Za-z]/u);
      expect(rows.findIndex((row) => /[A-Za-z]/u.test(row))).toBeGreaterThan(1);
    }
  });

  it("keeps the notch at the tightest padding, which is where a row has to be paid for", () => {
    const rows = one({ paddingY: 0 }).filter((row) => row.trim() !== "");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toContain(RISE);
  });
});

describe("a LINED rectangle, `lin-rect`, drawn with its lines", () => {
  const one = (options = {}): string[] =>
    render(`flowchart TD\n    A@{ shape: lin-rect, label: "Lined" }\n`, { width: 60, ...options }).split("\n");

  it.each(["lin-rect", "lin-proc", "lined-process", "lined-rectangle", "shaded-process"])("answers to %s", (name) => {
    const rows = render(`flowchart TD\n    A@{ shape: ${name}, label: "Lined" }\n`, { width: 60 }).split("\n");
    expect(rows[1]).toStartWith("││");
  });

  it("bars its LEFT side and leaves the right one bare, which is what tells it from a subroutine", () => {
    const rows = one();
    for (const row of rows.slice(1, 4)) {
      expect(row).toStartWith("││");
      expect(row).not.toEndWith("││");
    }
    const sub = render(`flowchart TD\n    A[[Lined]]\n`, { width: 60 }).split("\n");
    expect(sub[1]).toEndWith("││");
  });

  it("keeps the bar off the frame's own corners, top row and bottom row alike", () => {
    const rows = one();
    expect(rows[0]).toStartWith("┌─");
    expect(rows[4]).toStartWith("└─");
  });

  it("buys the bar a column of its own, so a name never sits on it", () => {
    const rows = render(
      `flowchart TD\n    A@{ shape: lin-rect, label: "un nom assez long pour deux lignes" }\n`,
      { width: 26 }
    ).split("\n");
    for (const row of rows.filter((r) => /[A-Za-z]/u.test(r))) expect(row).toStartWith("││ ");
  });

  it("draws a plain box where there is no column to spare, rather than a bar over its own border", () => {
    const rows = render(`flowchart TD\n    A@{ shape: lin-rect, label: "x" }\n`, {
      width: 60,
      paddingX: 0,
      paddingY: 0,
    }).split("\n");
    expect(rows[1]).toStartWith("││");
  });
});

describe("a subroutine's own bars, never written over its label", () => {
  const shape = "flowchart LR\n    A[[sous programme]]\n";

  it.each([0, 1, 2, 3, 4])("keeps the whole label at padding %i", (paddingX) => {
    expect(render(shape, { paddingX })).toContain("sous programme");
  });

  it("keeps it at the tightest width the ladder compacts to", () => {
    const drawn = render("flowchart LR\n    A[[sous programme]] --> B[fin]\n", { width: 20 });
    expect(drawn).toContain("sous");
    expect(drawn).toContain("programme");
  });
});

describe("a database keeping its lid where the rows run out, the arrowhead piercing it", () => {
  const source = `flowchart
    subgraph Client
        A[Browser]
    end
    subgraph Server
        B[Load Balancer]
        C[App Server 1]
        D[App Server 2]
    end
    subgraph Data
        E[(PostgreSQL)]
        F[(Redis)]
    end
    A --> B
    B --> C
    B --> D
    C --> E
    D --> E
    C --> F
    D --> F`;

  const lidRow = (drawn: string): number => drawn.split("\n").findIndex((row) => row.includes("(▁"));

  it("writes the rim above the parens and the head into it, under a height", () => {
    const rows = render(source, { width: 55, height: 25 }).split("\n");
    const lid = lidRow(rows.join("\n"));
    expect(lid).toBeGreaterThan(1);
    expect(rows[lid - 1]).toMatch(/▁⏷▁/u);
    expect(rows[lid - 1]).not.toContain("(");
    expect(rows[lid - 2]).not.toMatch(/⏷/u);
  });

  it("leaves the drawing that HAS the rows exactly as it was, the head one row clear of the rim", () => {
    const rows = render(source, { width: 55 }).split("\n");
    const lid = lidRow(rows.join("\n"));
    expect(rows[lid - 1]).toMatch(/^[\s▁│]+$/u);
    expect(rows[lid - 2]).toMatch(/⏷/u);
  });

  it("keeps the rim off a cell something else has claimed", () => {
    const drawn = render("flowchart TD\n    subgraph S\n        B[(store)]\n    end\n", { paddingY: 0 });
    expect(drawn).toContain("┌───");
    expect(drawn).not.toMatch(/[┌─┐]▁/u);
  });
});
