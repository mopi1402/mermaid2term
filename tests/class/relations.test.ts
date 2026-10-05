import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { parseClassDiagram } from "../../src/diagrams/classdiagram/parser.js";
import { must } from "../../src/must.js";
import { ESC } from "../../src/paint/escapes.js";

describe("a class laid under the class it HANGS FROM, where every layer used to be centred on the drawing", () => {
  const rowsOf = (drawn: string): string[] => drawn.split("\n");
  const centreOf = (rows: string[], name: string): number => {
    const row = must(rows.find((r) => r.includes(name)));
    return row.indexOf(name) + Math.floor(name.length / 2);
  };
  const edgeRows = (rows: string[]): string[] =>
    rows.filter((r) => r.trim() !== "" && !/[┌└├a-zA-Z]/u.test(r) && !/│\s+│|│─/u.test(r));

  it("hangs Car straight under Vehicle, the lone Animal left where the source named it first", () => {
    const rows = rowsOf(render("classDiagram\n    direction TB\n    class Animal\n    Vehicle <|-- Car\n", { width: 80 }));
    expect(Math.abs(centreOf(rows, "Car") - centreOf(rows, "Vehicle"))).toBeLessThanOrEqual(1);
    expect(centreOf(rows, "Animal")).toBeLessThan(centreOf(rows, "Vehicle"));
    expect(edgeRows(rows).every((r) => /^[│△]$/u.test(r.trim()))).toBe(true);
  });

  it("stands a parent over the middle of its children, and keeps two families apart", () => {
    const rows = rowsOf(
      render("classDiagram\n    direction TB\n    Animal <|-- Duck\n    Animal <|-- Fish\n    Animal <|-- Zebra\n    Vehicle <|-- Car\n", {
        width: 80,
      })
    );
    expect(Math.abs(centreOf(rows, "Animal") - centreOf(rows, "Fish"))).toBeLessThanOrEqual(1);
    expect(Math.abs(centreOf(rows, "Car") - centreOf(rows, "Vehicle"))).toBeLessThanOrEqual(1);
    expect(centreOf(rows, "Car")).toBeGreaterThan(centreOf(rows, "Zebra"));
  });

  it("runs a chain of single children straight down, no edge jogging a column", () => {
    const rows = rowsOf(render("classDiagram\n    direction TB\n    A --> Bee\n    Bee --> Cat\n    Cat --> Doge\n", { width: 60 }));
    expect(edgeRows(rows).length).toBeGreaterThan(3);
    expect(edgeRows(rows).every((r) => /^[│⏷]$/u.test(r.trim()))).toBe(true);
  });
});

describe("a relationship's SOURCE over its target, whatever the marker, the way mermaid lays it", () => {
  const rowOf = (drawn: string, name: string): number => drawn.split("\n").findIndex((r) => r.includes(name));

  it("keeps the source on top of an inheritance written either way", () => {
    const written = render("classDiagram\n    direction TB\n    classA --|> classB : Inheritance\n    classM ..|> classN : Realization\n", { width: 60 });
    expect(rowOf(written, "classA")).toBeLessThan(rowOf(written, "classB"));
    expect(rowOf(written, "classM")).toBeLessThan(rowOf(written, "classN"));
    const reversed = render("classDiagram\n    direction TB\n    Animal <|-- Duck\n", { width: 60 });
    expect(rowOf(reversed, "Animal")).toBeLessThan(rowOf(reversed, "Duck"));
  });
});

describe("a relationship's label as a CHIP on the shaft, the way mermaid lays it", () => {
  const source = "classDiagram\n    direction TB\n    classA --|> classB : Inheritance\n    classC --* classD : Composition\n";
  const rowsOf = (drawn: string): string[] => drawn.split("\n");

  it("centres the words on the shaft's own column, the shaft parting around them", () => {
    const rows = rowsOf(render(source, { width: 80 }));
    const at = rows.findIndex((r) => r.includes("Inheritance"));
    const shaft = rows[at - 1].indexOf("│");
    const label = rows[at];
    const centre = label.indexOf("Inheritance") + Math.floor("Inheritance".length / 2);
    expect(Math.abs(centre - shaft)).toBeLessThanOrEqual(1);
    expect(label).not.toContain("│");
    expect(rows[at + 1].indexOf("│")).toBe(shaft);
  });

  it("sits in the middle of the SHAFT, the marker's cell left out of the count", () => {
    const rows = rowsOf(render("classDiagram\n    direction TB\n    B <|-- A : implements\n    E --o F : aggregation\n", { width: 80 }));
    const column = (word: string): { at: number; col: number } => {
      const at = rows.findIndex((r) => r.includes(word));
      return { at, col: rows[at].indexOf(word) + Math.floor(word.length / 2) };
    };
    const top = column("implements");
    expect(rows[top.at - 1][top.col]).toBe("│");
    expect(rows[top.at - 2][top.col]).toBe("△");
    expect(rows[top.at + 1][top.col]).toBe("│");
    const bottom = column("aggregation");
    expect(rows[bottom.at - 1][bottom.col]).toBe("│");
    expect(rows[bottom.at + 1][bottom.col]).toBe("│");
    expect(rows[bottom.at + 2][bottom.col]).toBe("◇");
  });

  it("lays a ground under the words and the blank either side, a fifth of the theme's primary over the page", () => {
    const plain = rowsOf(render(source, { width: 80 }));
    const at = plain.findIndex((r) => r.includes("Composition"));
    const painted = rowsOf(renderThemed(source, { width: 80 }, "classic"))[at];
    const grounds = [...painted.matchAll(new RegExp(`${ESC}\\[[0-9;]*48;2;(\\d+;\\d+;\\d+)m([^${ESC}]*)`, "gu"))];
    expect(grounds.map((m) => m[2]).join("")).toContain(" Composition ");
    expect(new Set(grounds.map((m) => m[1])).size).toBe(1);
    const [r, g, b] = must(grounds[0]?.[1]).split(";").map(Number);
    expect(Math.max(r, g, b)).toBeLessThan(80);
    expect(Math.max(r, g, b)).toBeGreaterThan(0);
  });

  it("keeps two chips apart, the columns spread for the wider one", () => {
    const rows = rowsOf(render("classDiagram\n    direction TB\n    A --> B : short\n    A --> C : a rather long label here\n", { width: 80 }));
    const row = must(rows.find((r) => r.includes("short")));
    expect(row).toMatch(/short\s+a rather long label here/u);
  });
});

describe("a LOLLIPOP interface, `bar ()-- foo`, drawn as a name and a ring where the line used to be refused", () => {
  const rowsOf = (drawn: string): string[] => drawn.split("\n");

  it("reads both spellings and marks the interface, not the class", () => {
    const lollipops = (source: string) => [...parseClassDiagram(source).classes.values()].filter((cls) => cls.lollipop);
    const one = parseClassDiagram("classDiagram\n  bar ()-- foo\n");
    expect(one.warnings).toEqual([]);
    expect(one.classes.get("foo")?.lollipop).toBe(false);
    expect(lollipops("classDiagram\n  bar ()-- foo\n").map((cls) => cls.label)).toEqual(["bar"]);
    expect(lollipops("classDiagram\n  foo --() bar\n").map((cls) => cls.label)).toEqual(["bar"]);
  });

  it("gives EACH `()` a node of its own, two classes hanging a `bar` hanging two rings", () => {
    const source = "classDiagram\n  Class01 --() bar\n  Class02 --() bar\n";
    expect([...parseClassDiagram(source).classes.values()].filter((cls) => cls.lollipop)).toHaveLength(2);
    const drawn = render(source, { width: 60 });
    expect(drawn.split("○")).toHaveLength(3);
    expect(drawn.split("bar")).toHaveLength(3);
  });

  it("draws the name over the ring and the line from the ring down to the class, no box and no arrowhead", () => {
    const rows = rowsOf(render("classDiagram\n  direction TB\n  bar ()-- foo\n", { width: 60 }));
    const name = rows.findIndex((r) => r.includes("bar"));
    const ring = rows.findIndex((r) => r.includes("○"));
    expect(ring).toBe(name + 1);
    expect(rows[ring].indexOf("○")).toBe(rows[ring + 1].indexOf("│"));
    expect(rows.filter((r) => r.includes("┌")).length).toBe(1);
    expect(rows.join("\n")).not.toMatch(/[△▽⏶⏷◆◇]/u);
  });

  it("turns the ring towards the class where the interface hangs under it", () => {
    const rows = rowsOf(render("classDiagram\n  direction TB\n  foo --() bar\n", { width: 60 }));
    const ring = rows.findIndex((r) => r.includes("○"));
    expect(rows.findIndex((r) => r.includes("bar"))).toBe(ring + 1);
    expect(rows[ring - 1].trim()).toBe("│");
  });
});

describe("`direction LR`, `RL` and `BT` drawn the way mermaid's dagre lays them", () => {
  const body =
    "  class Student {\n    -idCard : IdCard\n  }\n  class IdCard{\n    -id : int\n  }\n  class Bike{\n    -id : int\n  }\n" +
    '  Student "1" --o "1" IdCard : carries\n  Student "1" --o "1" Bike : rides\n';
  const drawnIn = (direction: string): string => render(`classDiagram\n  direction ${direction}\n${body}`, { width: 100 });
  // A wall wears a tee where a relation lands on it, so either side of the name may be one.
  const titled = (word: string): RegExp => new RegExp(String.raw`[│├┤]\s+${word}\s+[│├┤]`, "u");
  const colOf = (drawn: string, word: string): number =>
    Math.max(...drawn.split("\n").map((row) => row.search(titled(word))));
  const rowOf = (drawn: string, word: string): number => drawn.split("\n").findIndex((row) => titled(word).test(row));

  it("stands the source on the RIGHT in RL, a mirror of LR", () => {
    expect(colOf(drawnIn("LR"), "Student")).toBeLessThan(colOf(drawnIn("LR"), "IdCard"));
    expect(colOf(drawnIn("RL"), "Student")).toBeGreaterThan(colOf(drawnIn("RL"), "IdCard"));
  });

  it("stands the source at the BOTTOM in BT, a mirror of TB", () => {
    expect(rowOf(drawnIn("TB"), "Student")).toBeLessThan(rowOf(drawnIn("TB"), "IdCard"));
    expect(rowOf(drawnIn("BT"), "Student")).toBeGreaterThan(rowOf(drawnIn("BT"), "IdCard"));
  });

  it("leaves the source sideways in LR, turns once, and comes into the target sideways with its marker on the run", () => {
    const drawn = drawnIn("LR");
    expect(drawn).toMatch(/─◇│ -id/u);
    expect(drawn).not.toContain("││");
    expect(drawn).toMatch(/├──╯/u);
    expect(drawn).toMatch(/├──╮/u);
  });

  it("stretches the exit run of a fan to carry its widest cardinality over it, one trunk for the whole fan", () => {
    const drawn = render(
      `classDiagram\n  direction LR\n${body.replace(/Student "1"/gu, 'Student "1..n"')}`,
      { width: 100 }
    );
    expect(drawn).toMatch(/┐1\.\.n│[^\n]*\n│\s+Student\s+├────╯/u);
    expect(drawn).toMatch(/│─+│1\.\.n\n│\s+├────╮/u);
    expect(drawn).not.toContain("─1..n");
  });

  it("keeps a vertical fan's cardinalities on the OUTSIDE of their shafts, the left exit's on its left", () => {
    const drawn = render(
      'classDiagram\n  direction TB\n  class Student\n  class IdCard\n  class Bike\n  Student "many" --o "1" IdCard : carries\n  Student "1y" --o "1" Bike : rides\n',
      { width: 80 }
    );
    expect(drawn).toMatch(/many│ │1y/u);
  });

  it("cuts a TEE into the outline at an end carrying no marker, the way a flowchart's box wears the edge it holds", () => {
    const drawn = render("classDiagram\n  direction TB\n  Animal <|-- Dog\n  Animal <|-- Cat\n", { width: 60 });
    // The two children are the unmarked ends: their top rules carry the tee, and the marked end at Animal does not.
    expect(drawn.split("┴")).toHaveLength(3);
    expect(drawn).toMatch(/┌─+┴─+┐\s+┌─+┴─+┐/u);
    expect(drawn).toMatch(/△\s+△/u);
    const sideways = render("classDiagram\n  direction LR\n  Animal <|-- Dog\n", { width: 60 });
    expect(sideways).toMatch(/├─+◁|◁─+┤/u);
  });

  it("carries the chip on the far run, between the elbow and the marker", () => {
    expect(drawnIn("LR")).toMatch(/╭─ carries ─◇│/u);
    expect(drawnIn("RL")).toMatch(/│◇─ carries ─╮/u);
  });

  it("writes a cardinality OVER the run against its marker, never on the stroke, so a `0..*` is neither buried nor a shaft", () => {
    const drawn = render('classDiagram\n  direction LR\n  Customer "1" --> "0..*" Ticket : books\n  Customer *-- Wallet\n', {
      width: 80,
    });
    const rows = drawn.split("\n");
    const arrow = rows.findIndex((row) => row.includes("─⏵│"));
    expect(rows[arrow - 1].slice(0, rows[arrow].indexOf("⏵") + 1)).toMatch(/0\.\.\*$/u);
    expect(drawn).not.toContain("0..*⏵");
    expect(drawn).not.toContain("─1─");
  });
});
