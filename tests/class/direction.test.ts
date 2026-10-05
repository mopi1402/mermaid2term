import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { parseClassDiagram } from "../../src/diagrams/classdiagram/parser.js";
import { Direction } from "../../src/graph/model.js";
import { widest } from "../support/drawn.js";

describe("a class diagram whose header names no direction, laid ACROSS the page where mermaid lays it down", () => {
  const family = "classDiagram\n    Animal <|-- Duck\n    Animal <|-- Fish\n";
  const rowOf = (drawn: string, name: string): number => drawn.split("\n").findIndex((row) => row.includes(name));
  const colOf = (drawn: string, name: string): number =>
    Math.max(...drawn.split("\n").map((row) => row.indexOf(name)));

  it("reads `LR` from a source that declares nothing, and says so was never declared", () => {
    const parsed = parseClassDiagram(family);
    expect(parsed.direction).toBe(Direction.LR);
    expect(parsed.directionDeclared).toBe(false);
  });

  it("stands the parent LEFT of its children, on their rows and not over them", () => {
    const drawn = render(family, { width: 80 });
    expect(colOf(drawn, "Animal")).toBeLessThan(colOf(drawn, "Duck"));
    expect(colOf(drawn, "Animal")).toBeLessThan(colOf(drawn, "Fish"));
    expect(rowOf(drawn, "Duck")).toBeLessThan(rowOf(drawn, "Fish"));
  });

  it("honours a `direction TB` written in the source, the drawing hanging down again", () => {
    const drawn = render(`classDiagram\n    direction TB\n    Animal <|-- Duck\n    Animal <|-- Fish\n`, { width: 80 });
    expect(parseClassDiagram("classDiagram\n    direction TB\n    A <|-- B\n").directionDeclared).toBe(true);
    expect(rowOf(drawn, "Animal")).toBeLessThan(rowOf(drawn, "Duck"));
    expect(rowOf(drawn, "Duck")).toBe(rowOf(drawn, "Fish"));
  });

  it("sets two families side by side when the budget carries them, and wraps onto a new row when it does not", () => {
    const pairs = `classDiagram\n${["A", "C", "E", "G"].map((one) => `    ${one} --> ${one}2 : holds\n`).join("")}`;
    const rowOf = (drawn: string, name: string): number => drawn.split("\n").findIndex((row) => row.includes(`${name} `));
    const wide = render(pairs, { width: 200 });
    expect(rowOf(wide, "A")).toBe(rowOf(wide, "C"));
    expect(rowOf(wide, "A")).toBe(rowOf(wide, "G"));
    const narrow = render(pairs, { width: 40 });
    expect(rowOf(narrow, "C")).toBeGreaterThan(rowOf(narrow, "A"));
  });

  it("turns the drawing DOWN where the width budget cannot carry it across", () => {
    const chain = "classDiagram\n    One --> Two : first\n    Two --> Three : second\n    Three --> Four : third\n";
    const across = render(chain, { width: 200 });
    const down = render(chain, { width: 40 });
      expect(widest(across)).toBeGreaterThan(40);
    expect(widest(down)).toBeLessThanOrEqual(40);
    expect(down.split("\n").length).toBeGreaterThan(across.split("\n").length);
  });

  it("keeps the drawing of a headerless source the one an `LR` header draws", () => {
    expect(render(family, { width: 80 })).toBe(render(`classDiagram\n    direction LR\n    Animal <|-- Duck\n    Animal <|-- Fish\n`, { width: 80 }));
  });
});
