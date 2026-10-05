import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { parseClassDiagram } from "../../src/diagrams/classdiagram/parser.js";
import { must } from "../../src/must.js";
import { withConfig } from "../support/frontmatter.js";
import { ESC } from "../../src/paint/escapes.js";

describe("a class wearing the LABEL its `[\"...\"]` gives it, where the line used to be dropped", () => {
  const source = 'classDiagram\n    class Animal["Animal with a label"]\n    class Car["Car with *! symbols"]\n    Animal --> Car\n';

  it("writes the label on the box and keeps the id for the relationships", () => {
    const drawn = render(source, { width: 80 });
    expect(drawn).toContain("Car with *! symbols");
    expect(drawn).toContain("Animal with a label");
    expect(parseClassDiagram(source).warnings).toEqual([]);
    expect(parseClassDiagram(source).relationships[0]).toMatchObject({ source: "Animal", target: "Car" });
  });

  it("reads it on the braced form too, and breaks it on a `<br>`", () => {
    const drawn = render('classDiagram\n    class Car["Fast<br>Car"] {\n        +run()\n    }\n', { width: 60 });
    const rows = drawn.split("\n");
    expect(rows.findIndex((r) => r.includes("Car")) - rows.findIndex((r) => r.includes("Fast"))).toBe(1);
    expect(drawn).toContain("+run()");
  });

  it("widens the box to the label, and not to the id", () => {
    const lid = render(source, { width: 80 }).split("\n").filter((r) => r.includes("┌"));
    expect(lid.some((r) => r.length >= "Car with *! symbols".length + 4)).toBe(true);
  });
});

describe("a class id in BACKTICKS, carrying the blanks and symbols a bare id cannot", () => {
  const source =
    "classDiagram\n    direction TB\n    class `Animal Class!`\n    class `Car Class`\n    `Animal Class!` --> `Car Class`\n" +
    '    `Car Class` : +int wheels\n    note for `Car Class` "vroom"\n    <<interface>> `Car Class`\n';

  it("reads the id everywhere one is written, the backticks taken off", () => {
    const parsed = parseClassDiagram(source);
    expect(parsed.warnings).toEqual([]);
    expect([...parsed.classes.keys()]).toEqual(["Animal Class!", "Car Class"]);
    expect(parsed.relationships[0]).toMatchObject({ source: "Animal Class!", target: "Car Class" });
    expect(parsed.notes[0]).toMatchObject({ target: "Car Class" });
    expect(parsed.classes.get("Car Class")).toMatchObject({ annotation: "interface" });
  });

  it("draws the words on the box, with no backtick left", () => {
    const drawn = render(source, { width: 60 });
    expect(drawn).toContain("│ Animal Class! │");
    expect(drawn).toContain("+int wheels");
    expect(drawn).not.toContain("`");
  });
});

describe("a method's return type written after ` : `, the way mermaid writes it", () => {
  it("parts the signature and the type with a spaced colon", () => {
    const drawn = render("classDiagram\nclass BankAccount{\n    +deposit(amount) bool\n    +withdrawal(amount) int$\n}\n", { width: 60 });
    expect(drawn).toContain("+deposit(amount) : bool");
    expect(drawn).toContain("+withdrawal(amount) : int ");
  });
});

describe("a GENERIC written between tildes, drawn in the angle brackets mermaid draws it in", () => {
  const source =
    "classDiagram\nclass Square~Shape~{\n    int id\n    List~int~ position\n    getPoints() List~int~\n}\n" +
    "Square : +getDistanceMatrix() List~List~int~~\n";

  it("brackets the generics of the members, the nested ones inside out", () => {
    const drawn = render(source, { width: 80 });
    expect(drawn).toContain("List<int> position");
    expect(drawn).toContain("getPoints() : List<int>");
    expect(drawn).toContain("+getDistanceMatrix() : List<List<int>>");
    expect(drawn).not.toContain("~");
  });

  it("writes the class's generic on its name, and keeps the bare name for the relationships", () => {
    const parsed = parseClassDiagram(source + "Square~Shape~ <|-- Rhombus~Shape~\n");
    expect(parsed.warnings).toEqual([]);
    expect(parsed.classes.get("Square")).toMatchObject({ label: "Square<Shape>" });
    expect(parsed.classes.get("Rhombus")).toMatchObject({ label: "Rhombus<Shape>" });
    expect(parsed.relationships[0]).toMatchObject({ source: "Square", target: "Rhombus" });
    expect(render(source, { width: 80 })).toContain("Square<Shape>");
  });

  it("brackets a generic a comma splits, as mermaid 12 joins its two sides, and reads a leading `~` as `package`", () => {
    const parsed = parseClassDiagram("classDiagram\nclass A{\n    ~pkg(Map~K, V~ m)\n    Map~string,int~ counts\n}\n");
    const [method, field] = must(parsed.classes.get("A")).members;
    expect(method).toMatchObject({ visibility: "~" });
    expect(method?.name).toContain("Map<K, V>");
    expect(field).toMatchObject({ name: "counts", returnType: "Map<string,int>" });
  });
});

describe("a member's classifier worn as a STYLE, the way mermaid wears it, and never written as its sign", () => {
  const source =
    "classDiagram\nclass A{\n    String someField$\n    plain()\n    someAbstractMethod()*\n    other() int*\n    someStaticMethod()$\n}\n";
  const codesOf = (row: string): string[] =>
    [...row.matchAll(new RegExp(`${ESC}\\[([0-9;]*)m`, "gu"))].flatMap((m) => m[1].split(";"));
  const rowWith = (painted: string, word: string): string => {
    const at = render(source, { width: 60 }).split("\n").findIndex((r) => r.includes(word));
    return painted.split("\n")[at];
  };

  it("takes the sign off the row", () => {
    const drawn = render(source, { width: 60 });
    expect(drawn).toContain("│ String someField ");
    expect(drawn).toContain("│ someAbstractMethod() ");
    expect(drawn).toContain("│ other() : int ");
    expect(drawn).toContain("│ someStaticMethod() ");
    expect(drawn).not.toMatch(/[*$]/u);
  });

  it("draws an abstract member in italics and a static one underlined, a plain one in neither", () => {
    const painted = renderThemed(source, { width: 60 }, "classic");
    expect(codesOf(rowWith(painted, "someAbstractMethod"))).toContain("3");
    expect(codesOf(rowWith(painted, "other()"))).toContain("3");
    expect(codesOf(rowWith(painted, "someStaticMethod"))).toContain("4");
    expect(codesOf(rowWith(painted, "someField"))).toContain("4");
    const staticRow = rowWith(painted, "someStaticMethod");
    expect(staticRow).toMatch(/\u001b\[(?:[0-9;]*;)?4(?:;[0-9;]*)?m[^\u001b]*someStaticMethod\(\)/u);
    expect(codesOf(rowWith(painted, "plain()"))).not.toContain("3");
    expect(codesOf(rowWith(painted, "plain()"))).not.toContain("4");
  });

  it.each([["classic", "dark"], ["default", "dark"], ["default", "light"], ["neon", "dark"]] as const)(
    "underlines the blanks inside a static member as its words, on a box's fill too, theme %s on %s",
    (theme, background) => {
      const row = renderThemed("classDiagram\nclass A{\n    +int instances$\n    +open(String dsn) A$\n}\n", { width: 60, background }, theme)
        .split("\n")
        .find((line) => line.includes("instances")) ?? "";
      const cells: Array<readonly [string, string]> = [];
      let sgr = "";
      for (const found of row.matchAll(/\u001b\[([0-9;]*)m|(.)/gu)) {
        if (found[1] !== undefined) sgr = found[1] === "0" ? "" : found[1];
        else cells.push([found[2], sgr]);
      }
      const text = cells.map(([ch]) => ch).join("");
      const start = text.indexOf("+int");
      for (let at = start; at < start + "+int instances".length; at++) expect(cells[at][1].split(";")[0]).toBe("4");
      expect(cells[start + "+int instances".length][1].split(";")[0]).not.toBe("4");
    }
  );
});

describe("`config.class.hideEmptyMembersBox`, a class with nothing in it drawn as its name alone", () => {
  const fm = withConfig({ class: { hideEmptyMembersBox: true } }, "");

  it("drops both compartments of a class with no member at all, and keeps them where one has any", () => {
    const drawn = render(`${fm}classDiagram\n  direction TB\n  class Duck {\n    +quack()\n  }\n  class Egg\n  Duck --> Egg\n`, { width: 60 });
    expect(drawn).toMatch(/│\s+Egg\s+│\n\s*└─+┘/u);
    expect(drawn).toMatch(/│\s+Duck\s+│\n\s*├─+┤/u);
    expect(drawn).toContain("+quack()");
  });

  it("keeps an annotation over the name, the two rows being all the box is", () => {
    const drawn = render(`${fm}classDiagram\n  class Egg\n  <<interface>> Egg\n`, { width: 60 });
    expect(drawn).toMatch(/┌─+┐\n\s*│\s+«interface»\s+│\n\s*│\s+Egg\s+│\n\s*└─+┘/u);
  });

  it("still draws the two empty compartments without the key, as mermaid does by default", () => {
    expect(render("classDiagram\n  class Duck\n", { width: 40 })).toMatch(/│\s+Duck\s+│\n\s*├─+┤/u);
  });

  it("lays a `style` on the smaller box, its ring and nothing past it", () => {
    const painted = renderThemed(`${fm}classDiagram\n  class Egg\n  style Egg fill:#bbf,stroke:#f66\n`, { width: 40 }, "classic");
    expect(painted).toContain("48;2;187;187;255");
    expect(render(`${fm}classDiagram\n  class Egg\n  style Egg fill:#bbf,stroke:#f66\n`, { width: 40 }).split("\n").filter((row) => row.trim() !== "")).toHaveLength(3);
  });
});
