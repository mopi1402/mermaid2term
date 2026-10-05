import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { parseERDiagram } from "../../src/diagrams/erdiagram/parser.js";
import { displayName, groupOf } from "../../src/diagrams/erdiagram/model.js";
import { must } from "../../src/must.js";

const WIDTH = 70;
const drawn = (source: string): string => render(source, { width: WIDTH });
const namesOf = (source: string): string[] => [...parseERDiagram(source).entities.keys()];
const entity = (source: string, name: string) => must(parseERDiagram(source).entities.get(name));

// Every line below is one mermaid reads and this dropped, drew as something else, or read only in part. The
// grammar is `erDiagram.jison` of 11.17, whose lexer opens on `%options case-insensitive`.
describe("ER statements mermaid reads that came out wrong", () => {
  it("reads a dotted name, mermaid's `UNICODE_TEXT` carrying `.` beside `\\w`, `-` and `*`", () => {
    const parsed = parseERDiagram("erDiagram\n    public.users ||--o{ public.orders : places\n");
    expect(namesOf("erDiagram\n    public.users ||--o{ public.orders : places\n")).toEqual(["public.users", "public.orders"]);
    expect(parsed.relationships[0].label).toBe("places");
    // `entityName` takes a `DECIMAL_NUM` too, so a number with a point is a name and not a dropped line.
    expect(namesOf("erDiagram\n    3.5 ||--|| 42 : counts\n")).toEqual(["3.5", "42"]);
    expect(drawn("erDiagram\n    public.users ||--o{ public.orders : places\n")).toContain("public.users");
  });

  it("reads `many` and `one` standing alone, which the lexer gives their own tokens", () => {
    const parsed = parseERDiagram("erDiagram\n    A many to one B : x\n");
    expect(parsed.relationships).toHaveLength(1);
    // `many` is ZERO_OR_MORE and `one` is ONLY_ONE, the same reading as the spelt-out aliases.
    expect(drawn("erDiagram\n    A many to one B : x\n")).toBe(drawn("erDiagram\n    A zero or more to only one B : x\n"));
  });

  it("reads `.-` and `-.`, both non-identifying in mermaid, as `..` already was", () => {
    const dotted = drawn("erDiagram\n    A ||..o{ B : x\n");
    expect(drawn("erDiagram\n    A ||.-o{ B : x\n")).toBe(dotted);
    expect(drawn("erDiagram\n    A ||-.o{ B : x\n")).toBe(dotted);
    expect(dotted).not.toBe(drawn("erDiagram\n    A ||--o{ B : x\n"));
  });

  it("wears every class behind one `:::`, and leaves the statement it stands in whole", () => {
    const source = "erDiagram\n    classDef c1 fill:#f96\n    classDef c2 stroke-width:4px\n    A:::c1,c2 ||--o{ B : x\n";
    const parsed = parseERDiagram(source);
    // The relationship used to go out with the classes: `,c2 ||--o{ B : x` matched no statement at all.
    expect(parsed.relationships).toHaveLength(1);
    expect(must(parsed.entities.get("A")).cssClasses).toEqual(["c1", "c2"]);
    expect(drawn(source)).toContain("┏");
  });

  it("keeps an alias written in front of a `:::`, mermaid's `SQS entityName SQE STYLE_SEPARATOR idList`", () => {
    const source = "erDiagram\n    classDef c1 stroke-width:4px\n    p[Person]:::c1\n    p ||--o{ B : x\n";
    const parsed = parseERDiagram(source);
    expect(displayName(must(parsed.entities.get("p")))).toBe("Person");
    expect(must(parsed.entities.get("p")).cssClasses).toEqual(["c1"]);
    expect(drawn(source)).toContain("Person");
  });

  it("reads the `class` statement, mermaid's `CLASS idList idList`, on entities and on frames alike", () => {
    const source = "erDiagram\n    classDef c1 stroke-width:4px\n    A ||--o{ B : x\n    class A,B c1\n";
    const parsed = parseERDiagram(source);
    expect(must(parsed.entities.get("A")).cssClasses).toEqual(["c1"]);
    expect(must(parsed.entities.get("B")).cssClasses).toEqual(["c1"]);
    expect(drawn(source)).toBe(drawn("erDiagram\n    classDef c1 stroke-width:4px\n    A:::c1 ||--o{ B:::c1 : x\n"));
  });

  it("reads a key in any case, the whole lexer being case-insensitive, and keeps the word as written", () => {
    const rows = entity("erDiagram\n    A {\n        string id pk\n        string owner Fk\n        string phone UK\n    }\n", "A").attributes;
    expect(rows.map((row) => row.keys.join(","))).toEqual(["pk", "Fk", "UK"]);
    expect(rows).toHaveLength(3);
  });

  it("strips a whole comment line inside an attribute block, as it is stripped everywhere else", () => {
    const rows = entity("erDiagram\n    A {\n        %% the key\n        string id PK\n    }\n", "A").attributes;
    expect(rows.map((row) => row.name)).toEqual(["id"]);
  });

  it.each(["TD", "LR"])("cuts a comment written after a statement, a quoted one kept, direction %s", (direction) => {
    const source = `erDiagram\n    direction ${direction}\n    A ||--o{ B : has %% note\n    B {\n        string id PK %% the key\n    }\n    C }|--|| D : "50%% off"\n`;
    const parsed = parseERDiagram(source);
    expect(parsed.relationships.map((r) => r.label)).toEqual(["has", "50%% off"]);
    expect(entity(source, "B").attributes.map((row) => [row.name, row.keys.join(",")])).toEqual([["id", "PK"]]);
    for (const width of [40, 120]) {
      const out = render(source, { width });
      expect(out).not.toContain("note");
      expect(out).toContain("50%% off");
    }
  });

  it("swallows an `accDescr { }` block, which mermaid reads into its accessible description", () => {
    const source = "erDiagram\n    accDescr {\n      a description\n    }\n    A ||--o{ B : x\n";
    expect(namesOf(source)).toEqual(["A", "B"]);
    expect(drawn(source)).toBe(drawn("erDiagram\n    A ||--o{ B : x\n"));
  });

  it("opens a block written on one row, empty or carrying its attribute", () => {
    expect(namesOf("erDiagram\n    CUSTOMER {}\n")).toEqual(["CUSTOMER"]);
    const rows = entity("erDiagram\n    CUSTOMER { string name }\n", "CUSTOMER").attributes;
    expect(rows.map((row) => [row.type, row.name])).toEqual([["string", "name"]]);
    expect(drawn("erDiagram\n    CUSTOMER { string name }\n")).toContain("name");
  });

  it("brackets a generic in every cell of a row and in the name, as `addText` does in `erBox`", () => {
    const rows = entity('erDiagram\n    A {\n        List~Item~ lines\n        string many~T~ "holds a List~Item~"\n    }\n', "A").attributes;
    expect(rows[0].type).toBe("List<Item>");
    expect(rows[1].name).toBe("many<T>");
    expect(rows[1].comment).toBe("holds a List<Item>");
    expect(displayName(entity('erDiagram\n    "Box~T~" ||--|| B : x\n', "Box~T~"))).toBe("Box<T>");
    // The name stays the key every relationship names its ends by.
    expect(namesOf('erDiagram\n    "Box~T~" ||--|| B : x\n')).toEqual(["Box~T~", "B"]);
  });

  it("styles a subgraph by id, mermaid's `addCssStyles` and `setClass` both looking one up", () => {
    const styled = "erDiagram\n    subgraph grp\n      A\n    end\n    style grp stroke-width:4px\n";
    const worn = "erDiagram\n    classDef c1 stroke-width:4px\n    subgraph grp\n      A\n    end\n    class grp c1\n";
    expect(must(groupOf(parseERDiagram(styled).groups, "grp")).styles.get("stroke-width")).toBe("4px");
    expect(must(groupOf(parseERDiagram(worn).groups, "grp")).cssClasses).toEqual(["c1"]);
    expect(drawn(styled)).toContain("┏");
    expect(drawn(worn)).toBe(drawn(styled));
    expect(drawn(styled)).not.toBe(drawn("erDiagram\n    subgraph grp\n      A\n    end\n"));
  });

  it("reaches a frame buried in another, the id being looked up however deep it stands", () => {
    const source = "erDiagram\n    subgraph outer\n      subgraph inner\n        A\n      end\n    end\n    style inner stroke-width:4px\n";
    expect(must(groupOf(parseERDiagram(source).groups, "inner")).styles.size).toBe(1);
    expect(drawn(source)).toContain("┏");
  });
});

// Each measured on mermaid 12 headless (2026-09-29).
describe("ER statements mermaid 12 reads that were dropped", () => {
  const rel = (source: string) => parseERDiagram(source).relationships.map((r) => [r.entity1, r.card1, r.card2, r.entity2, r.lineStyle, r.label]);
  const rowOf = (drawing: string, word: string): number => drawing.split("\n").findIndex((row) => row.includes(word));

  it("reads the statement written on the header line", () => {
    expect(rel("erDiagram A ||--|| B : x\n")).toEqual([["A", "||", "||", "B", "solid", "x"]]);
    for (const direction of ["TB", "LR"]) {
      const drawing = drawn(`erDiagram A ||--|| B : x\n    direction ${direction}\n`);
      expect(drawing).toContain("A");
      expect(drawing).toContain("B");
    }
  });

  it("reads a direction wherever it stands on the line, the whole line going with it", () => {
    for (const [line, direction] of [["foo direction LR", "LR"], ["direction LR extra words", "LR"], ["foo direction TB bar", "TB"]] as const) {
      const parsed = parseERDiagram(`erDiagram\n    ${line}\n    A ||--|| B : x\n`);
      expect([parsed.direction, parsed.directionDeclared]).toEqual([direction, true]);
    }
    expect(rel('erDiagram\n    C ||--|| D : "direction LR"\n')).toEqual([]);
    const across = drawn("erDiagram\n    foo direction LR\n    A ||--|| B : x\n");
    expect(rowOf(across, "A")).toBe(rowOf(across, "B"));
    const down = drawn("erDiagram\n    foo direction TB\n    A ||--|| B : x\n");
    expect(rowOf(down, "A")).toBeLessThan(rowOf(down, "B"));
  });

  it("reads an attribute's words written between backticks, spaces and all", () => {
    const attributes = entity("erDiagram\n    A {\n        `my type` `my name` PK \"c\"\n        string `other name`\n    }\n", "A").attributes;
    expect(attributes.map((a) => [a.type, a.name, a.keys, a.comment])).toEqual([["my type", "my name", ["PK"], "c"], ["string", "other name", [], ""]]);
    for (const direction of ["TB", "LR"]) {
      const drawing = drawn(`erDiagram\n    direction ${direction}\n    A {\n        \`my type\` \`my name\`\n    }\n    A ||--|| B : x\n`);
      expect(drawing).toContain("my type");
      expect(drawing).toContain("my name");
      expect(drawing).not.toContain("`");
    }
  });

  it("reads a cardinality word beside a glyph, and a line word beside a glyph line", () => {
    const want = [["C", "||", "o{", "D", "solid", "y"]];
    for (const line of ["C 1 to o{ D : y", "C 1--o{ D : y", "C ||--many D : y", "C one -- many D : y", "C || to zero or more D : y"]) {
      expect(rel(`erDiagram\n    ${line}\n`)).toEqual(want);
    }
    expect(rel("erDiagram\n    C 1 optionally to o{ D : y\n")).toEqual([["C", "||", "o{", "D", "dashed", "y"]]);
    expect(rel("erDiagram\n    C ||..one D : y\n")).toEqual([["C", "||", "||", "D", "dashed", "y"]]);
    for (const direction of ["TB", "LR"]) {
      expect(drawn(`erDiagram\n    direction ${direction}\n    C 1 to o{ D : y\n`)).toBe(drawn(`erDiagram\n    direction ${direction}\n    C ||--o{ D : y\n`));
    }
  });

  it("reads mermaid's `u`, MD_PARENT, an end drawn with no marker at all", () => {
    expect(rel("erDiagram\n    A u--|| B : x\n")).toEqual([["A", "u", "||", "B", "solid", "x"]]);
    expect(rel("erDiagram\n    A u..o{ B : x\n")).toEqual([["A", "u", "o{", "B", "dashed", "x"]]);
    const across = drawn("erDiagram\n    direction LR\n    A u--|| B : x\n");
    const row = across.split("\n")[rowOf(across, " x ")];
    expect(row.slice(row.indexOf("├") + 1, row.indexOf(" x "))).toMatch(/^─+$/u);
    expect(row).toContain("╫┤");
    const down = drawn("erDiagram\n    direction TB\n    A u--|| B : x\n").split("\n");
    const wall = down.findIndex((line) => line.includes("┬"));
    const col = down[wall].indexOf("┬");
    expect(down[wall + 1][col]).toBe("│");
    expect(down.some((line) => line.includes("╪"))).toBe(true);
    // A loop's end leaves the wall on its line, the cell a marker would take never left bare.
    for (const direction of ["TB", "LR"]) {
      const loop = drawn(`erDiagram\n    direction ${direction}\n    A u--|| A : self\n`);
      expect(loop).toContain("├─");
      expect(loop).not.toContain("├ ");
    }
  });
});
