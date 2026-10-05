import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { parseClassDiagram } from "../../src/diagrams/classdiagram/parser.js";
import { renderClassDiagram } from "../../src/diagrams/classdiagram/render.js";
import { UNICODE } from "../../src/canvas/charsets.js";

const rowsOf = (source: string, options = {}): string[] =>
  render(source, { width: 80, ...options }).split("\n").map((row) => row.trim()).filter((row) => row !== "");

describe("a class shows both compartments, an empty one as a blank band, as mermaid draws it", () => {
  it.each(["TB", "LR"])("gives a class with METHODS only a blank attribute band above them, direction %s", (direction) => {
    const rows = rowsOf(`classDiagram\n    direction ${direction}\n    class Dog {\n        +fetch()\n    }\n`);
    expect(rows).toEqual(["┌──────────────┐", "│     Dog      │", "├──────────────┤", "│              │", "│──────────────│", "│ +fetch()     │", "└──────────────┘"]);
  });

  it.each(["TB", "LR"])("gives a class with ATTRIBUTES only a blank method band under them, direction %s", (direction) => {
    const rows = rowsOf(`classDiagram\n    direction ${direction}\n    class Point {\n        +int x\n    }\n`);
    expect(rows).toEqual(["┌──────────────┐", "│    Point     │", "├──────────────┤", "│ +int x       │", "│──────────────│", "│              │", "└──────────────┘"]);
  });

  it("keeps BOTH bands when a class has attributes and methods, the rule under the attributes the faint one", () => {
    const rows = rowsOf("classDiagram\n    class Animal {\n        +String name\n        +makeSound()\n    }\n");
    expect(rows).toEqual([
      "┌──────────────┐",
      "│    Animal    │",
      "├──────────────┤",
      "│ +String name │",
      "│──────────────│",
      "│ +makeSound() │",
      "└──────────────┘",
    ]);
  });

  it("keeps mermaid's TWO empty bands for a class with no member at all, `hideEmptyMembersBox` being the knob for that one", () => {
    const diagram = parseClassDiagram("classDiagram\n    class Duck\n");
    expect(renderClassDiagram(diagram, UNICODE).toString()).toMatch(/│\s+Duck\s+│\n\s*├─+┤\n\s*│\s+│\n\s*│─+│\n\s*│\s+│\n\s*└─+┘/u);
    expect(renderClassDiagram(diagram, UNICODE, 2, 4, true, true).toString()).not.toMatch(/├─+┤/u);
  });

  it.each(["TB", "LR"])("draws the blank band under `borders: padless` too, direction %s", (direction) => {
    const rows = rowsOf(`classDiagram\n    direction ${direction}\n    class Dog {\n        +fetch()\n    }\n`, { borders: "padless" });
    expect(rows).toEqual(["▕▔▔▔▔▔▔▔▔▔▔▔▔▔▔▏", "▕     Dog      ▏", "▕ ──────────── ▏", "▕              ▏", "▕ ──────────── ▏", "▕ +fetch()     ▏", "▕▁▁▁▁▁▁▁▁▁▁▁▁▁▁▏"]);
  });
});
